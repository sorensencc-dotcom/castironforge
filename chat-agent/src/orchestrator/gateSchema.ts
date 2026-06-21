/**
 * H-3: Machine-Readable Gate Decision Schema
 *
 * Remediation for Gap H-3: No formal gate decision schema.
 * Standardized JSON Schema format for HITL gate definitions, enabling:
 * - Validator compatibility across frameworks
 * - Operator decision guidance with structured prompts
 * - Audit trail with schema versioning
 * - Automated schema validation at gate invocation
 */

export interface GateDecisionOption {
  code: string; // 'APPROVE', 'REJECT', 'MODIFY', 'ESCALATE'
  label: string;
  description: string;
  guidance?: string; // Operator guidance for this option
  escalation_target?: 'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER';
}

export interface GateModificationField {
  field_name: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  description: string;
  allowed_values?: string[]; // For select type
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string; // Regex for text
  };
}

export interface HITLGateSchema {
  gate_id: string;
  schema_version: string; // Semantic versioning (e.g., "1.0.0")
  description: string;
  decision_prompt: string; // Instructions for operator
  required_context: string[]; // Fields operator must see (e.g., ["model_output", "confidence_score", "retrieval_results"])
  decision_options: GateDecisionOption[];
  modification_fields?: GateModificationField[]; // Present if 'MODIFY' option exists
  slo_compliance_check?: {
    metric: string; // e.g., "accuracy", "latency_ms"
    threshold: number;
    operator_guidance: string;
  };
  audit_fields: {
    include_confidence: boolean;
    include_modification_delta: boolean;
    include_operator_notes: boolean;
  };
}

export interface GateDecisionSubmission {
  gate_id: string;
  schema_version: string;
  operator_decision: string; // Must match one of decision_options.code
  operator_role: 'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER';
  modification_delta?: Record<string, unknown>; // Structured modifications per schema
  operator_notes?: string;
  decision_timestamp: string;
  decision_duration_ms: number;
}

/**
 * Validate gate decision against schema
 */
export function validateGateDecision(
  submission: GateDecisionSubmission,
  schema: HITLGateSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check schema version match
  if (submission.schema_version !== schema.schema_version) {
    errors.push(
      `Schema version mismatch: submission v${submission.schema_version} vs gate v${schema.schema_version}`
    );
  }

  // Check decision option is valid
  const validOption = schema.decision_options.find(opt => opt.code === submission.operator_decision);
  if (!validOption) {
    errors.push(`Invalid decision option "${submission.operator_decision}". Valid options: ${schema.decision_options.map(o => o.code).join(', ')}`);
  }

  // Check modification fields if MODIFY decision
  if (submission.operator_decision === 'MODIFY' && schema.modification_fields) {
    if (!submission.modification_delta) {
      errors.push('MODIFY decision requires modification_delta');
    } else {
      for (const field of schema.modification_fields) {
        const value = submission.modification_delta[field.field_name];
        const fieldError = validateModificationField(field, value);
        if (fieldError) {
          errors.push(`${field.field_name}: ${fieldError}`);
        }
      }
    }
  }

  // Escalation rule: AI_SAFETY_OFFICER can always decide, others follow rules
  if (submission.operator_role !== 'AI_SAFETY_OFFICER' && validOption?.escalation_target) {
    const roleRank = { L1: 1, L2: 2, L3: 3, AI_SAFETY_OFFICER: 4 };
    if ((roleRank[submission.operator_role] || 0) < (roleRank[validOption.escalation_target] || 0)) {
      errors.push(`Operator role ${submission.operator_role} cannot make decision "${submission.operator_decision}". Required: ${validOption.escalation_target}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a single modification field
 */
function validateModificationField(field: GateModificationField, value: unknown): string | null {
  if (value === undefined && field.type !== 'boolean') {
    return `Required field not provided`;
  }

  switch (field.type) {
    case 'text':
      if (typeof value !== 'string') return `Expected string, got ${typeof value}`;
      if (field.constraints?.pattern && !new RegExp(field.constraints.pattern).test(value)) {
        return `Value does not match pattern ${field.constraints.pattern}`;
      }
      return null;

    case 'number':
      if (typeof value !== 'number') return `Expected number, got ${typeof value}`;
      if (field.constraints?.min !== undefined && value < field.constraints.min) {
        return `Value ${value} is below minimum ${field.constraints.min}`;
      }
      if (field.constraints?.max !== undefined && value > field.constraints.max) {
        return `Value ${value} is above maximum ${field.constraints.max}`;
      }
      return null;

    case 'select':
      if (!field.allowed_values?.includes(String(value))) {
        return `Value must be one of: ${field.allowed_values?.join(', ')}`;
      }
      return null;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== undefined) return `Expected boolean, got ${typeof value}`;
      return null;

    default:
      return null;
  }
}

/**
 * Create a gate schema (schema factory)
 */
export function createGateSchema(
  gateId: string,
  description: string,
  decisionPrompt: string,
  options: Array<{ code: string; label: string; description: string }>
): HITLGateSchema {
  return {
    gate_id: gateId,
    schema_version: '1.0.0',
    description,
    decision_prompt: decisionPrompt,
    required_context: ['model_output', 'confidence_score'],
    decision_options: options.map(opt => ({
      code: opt.code,
      label: opt.label,
      description: opt.description,
      escalation_target: opt.code === 'ESCALATE' ? 'AI_SAFETY_OFFICER' : undefined
    })),
    audit_fields: {
      include_confidence: true,
      include_modification_delta: true,
      include_operator_notes: true
    }
  };
}

/**
 * Example gate schemas for common workflows
 */

export const SCHEMA_REPORT_APPROVAL: HITLGateSchema = {
  gate_id: 'approve_financial_report',
  schema_version: '1.0.0',
  description: 'Approve or reject AI-generated financial report before publication',
  decision_prompt: 'Review the report. Does it accurately reflect company financials?',
  required_context: ['report_summary', 'confidence_score', 'audit_flags'],
  decision_options: [
    {
      code: 'APPROVE',
      label: 'Approve',
      description: 'Report is accurate and ready for publication',
      escalation_target: 'L1'
    },
    {
      code: 'REJECT',
      label: 'Reject',
      description: 'Report contains errors or misrepresentation',
      escalation_target: 'L2',
      guidance: 'Rejection triggers re-generation. Document specific issues.'
    },
    {
      code: 'MODIFY',
      label: 'Modify',
      description: 'Report needs corrections before publication',
      escalation_target: 'L2'
    }
  ],
  modification_fields: [
    {
      field_name: 'correction_type',
      type: 'select',
      description: 'Type of correction needed',
      allowed_values: ['numerical_error', 'missing_disclosure', 'formatting', 'other']
    },
    {
      field_name: 'correction_notes',
      type: 'text',
      description: 'Specific corrections required'
    }
  ],
  slo_compliance_check: {
    metric: 'accuracy',
    threshold: 0.95,
    operator_guidance: 'If accuracy < 95%, consider REJECT'
  },
  audit_fields: {
    include_confidence: true,
    include_modification_delta: true,
    include_operator_notes: true
  }
};

export const SCHEMA_CONTENT_REVIEW: HITLGateSchema = {
  gate_id: 'review_generated_content',
  schema_version: '1.0.0',
  description: 'Review AI-generated content for policy compliance',
  decision_prompt: 'Is this content compliant with company policy and brand standards?',
  required_context: ['content_text', 'confidence_score', 'policy_checks'],
  decision_options: [
    {
      code: 'APPROVE',
      label: 'Publish',
      description: 'Content is compliant and ready to publish',
      escalation_target: 'L1'
    },
    {
      code: 'REJECT',
      label: 'Reject',
      description: 'Content violates policy and must be regenerated',
      escalation_target: 'L2'
    },
    {
      code: 'MODIFY',
      label: 'Request Changes',
      description: 'Minor changes needed before publishing',
      escalation_target: 'L1'
    },
    {
      code: 'ESCALATE',
      label: 'Escalate to Safety Officer',
      description: 'Policy decision required from AI safety team',
      escalation_target: 'AI_SAFETY_OFFICER'
    }
  ],
  modification_fields: [
    {
      field_name: 'change_request',
      type: 'text',
      description: 'Specific requested changes'
    }
  ],
  audit_fields: {
    include_confidence: true,
    include_modification_delta: true,
    include_operator_notes: true
  }
};
