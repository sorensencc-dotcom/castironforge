/**
 * H-3: Machine-Readable Gate Decision Schema — Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateGateDecision,
  createGateSchema,
  SCHEMA_REPORT_APPROVAL,
  SCHEMA_CONTENT_REVIEW,
  GateDecisionSubmission,
  HITLGateSchema
} from '../gateSchema';

describe('H-3: Machine-Readable Gate Decision Schema', () => {
  describe('validateGateDecision', () => {
    let schema: HITLGateSchema;

    beforeEach(() => {
      schema = createGateSchema(
        'test-gate',
        'Test gate',
        'Make a decision',
        [
          { code: 'APPROVE', label: 'Approve', description: 'Approve' },
          { code: 'REJECT', label: 'Reject', description: 'Reject' },
          { code: 'MODIFY', label: 'Modify', description: 'Modify' }
        ]
      );
    });

    it('should validate valid decision', () => {
      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'APPROVE',
        operator_role: 'L1',
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid decision option', () => {
      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'INVALID',
        operator_role: 'L1',
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid decision option');
    });

    it('should reject schema version mismatch', () => {
      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '2.0.0',
        operator_decision: 'APPROVE',
        operator_role: 'L1',
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Schema version mismatch');
    });

    it('should enforce modification_delta for MODIFY decision', () => {
      // Add modification fields to schema
      schema.modification_fields = [
        { field_name: 'correction', type: 'text', description: 'Correction' }
      ];

      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'MODIFY',
        operator_role: 'L1',
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('requires modification_delta');
    });

    it('should validate modification fields', () => {
      schema.modification_fields = [
        {
          field_name: 'score',
          type: 'number',
          description: 'Score',
          constraints: { min: 0, max: 100 }
        }
      ];

      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'MODIFY',
        operator_role: 'L1',
        modification_delta: { score: 150 }, // Out of range
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('above maximum');
    });

    it('should enforce role-based access control', () => {
      schema.decision_options[1].escalation_target = 'L3'; // REJECT requires L3

      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'REJECT',
        operator_role: 'L1', // Too low
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cannot make decision');
    });

    it('should allow AI_SAFETY_OFFICER to bypass escalation', () => {
      schema.decision_options[1].escalation_target = 'L3';

      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'REJECT',
        operator_role: 'AI_SAFETY_OFFICER', // Can always decide
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(true);
    });

    it('should validate text field with regex pattern', () => {
      schema.modification_fields = [
        {
          field_name: 'email',
          type: 'text',
          description: 'Email',
          constraints: { pattern: '^[^@]+@[^@]+$' }
        }
      ];

      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'MODIFY',
        operator_role: 'L1',
        modification_delta: { email: 'invalid-email' },
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not match pattern');
    });

    it('should validate select field options', () => {
      schema.modification_fields = [
        {
          field_name: 'category',
          type: 'select',
          description: 'Category',
          allowed_values: ['bug', 'feature', 'docs']
        }
      ];

      const submission: GateDecisionSubmission = {
        gate_id: 'test-gate',
        schema_version: '1.0.0',
        operator_decision: 'MODIFY',
        operator_role: 'L1',
        modification_delta: { category: 'invalid' },
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 500
      };

      const result = validateGateDecision(submission, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of');
    });
  });

  describe('createGateSchema', () => {
    it('should create schema with defaults', () => {
      const schema = createGateSchema(
        'gate-1',
        'Test gate',
        'Please decide',
        [
          { code: 'APPROVE', label: 'Approve', description: 'Approve' }
        ]
      );

      expect(schema.gate_id).toBe('gate-1');
      expect(schema.schema_version).toBe('1.0.0');
      expect(schema.decision_options).toHaveLength(1);
      expect(schema.decision_options[0].code).toBe('APPROVE');
    });
  });

  describe('Pre-built schemas', () => {
    it('should have valid REPORT_APPROVAL schema', () => {
      expect(SCHEMA_REPORT_APPROVAL.gate_id).toBe('approve_financial_report');
      expect(SCHEMA_REPORT_APPROVAL.decision_options).toHaveLength(3);

      // Validate all options are valid
      for (const option of SCHEMA_REPORT_APPROVAL.decision_options) {
        expect(option.code).toBeTruthy();
        expect(option.label).toBeTruthy();
        expect(option.description).toBeTruthy();
      }
    });

    it('should have valid CONTENT_REVIEW schema', () => {
      expect(SCHEMA_CONTENT_REVIEW.gate_id).toBe('review_generated_content');
      expect(SCHEMA_CONTENT_REVIEW.decision_options).toHaveLength(4);

      // ESCALATE option should target AI_SAFETY_OFFICER
      const escalateOption = SCHEMA_CONTENT_REVIEW.decision_options.find(
        o => o.code === 'ESCALATE'
      );
      expect(escalateOption?.escalation_target).toBe('AI_SAFETY_OFFICER');
    });

    it('should allow valid decisions on pre-built schemas', () => {
      const submission: GateDecisionSubmission = {
        gate_id: 'approve_financial_report',
        schema_version: '1.0.0',
        operator_decision: 'APPROVE',
        operator_role: 'L1',
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 1000
      };

      const result = validateGateDecision(submission, SCHEMA_REPORT_APPROVAL);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid modifications on REPORT schema', () => {
      const submission: GateDecisionSubmission = {
        gate_id: 'approve_financial_report',
        schema_version: '1.0.0',
        operator_decision: 'MODIFY',
        operator_role: 'L2',
        modification_delta: {
          correction_type: 'invalid_type', // Invalid type
          correction_notes: 'Some notes'
        },
        decision_timestamp: new Date().toISOString(),
        decision_duration_ms: 1000
      };

      const result = validateGateDecision(submission, SCHEMA_REPORT_APPROVAL);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of');
    });
  });
});
