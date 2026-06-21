/**
 * H-1: Progressive Autonomy Framework
 *
 * Remediation for Gap H-1: No progressive autonomy model.
 * Static HITL gates create operator fatigue and rubber-stamp approvals.
 *
 * This module implements trust-based gate tier promotion: gates earn autonomy
 * through demonstrated reliability history, with formal AutonomyReviewBoard
 * governance for promotions.
 */

import { randomUUID } from 'crypto';

export type AutonomyLevel = 'BLOCKED' | 'CONFIRMATIONAL' | 'INFORMATIONAL' | 'AUTONOMOUS';

export type HITLDecision = 'approved' | 'rejected' | 'modified';

export interface HITLDecisionRecord {
  decision_id: string;
  gate_id: string;
  agent_id: string;
  decision: HITLDecision;
  operator_role: 'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER';
  timestamp: string;
  modification_delta?: Record<string, unknown>;
  confidence_at_gate: number;
  duration_ms: number;
  escalation_level: number;
}

export interface AutonomyPromotionRecord {
  promotion_id: string;
  gate_id: string;
  from_level: AutonomyLevel;
  to_level: AutonomyLevel;
  promotion_timestamp: string;
  board_members: string[];
  approval_streak: number;
  approval_window_days: number;
  modification_rate: number;
  rejection_rate: number;
  authority: 'AI_SAFETY_OFFICER' | 'AUTONOMY_REVIEW_BOARD';
  notes?: string;
}

export interface AutonomyGateConfig {
  gate_id: string;
  autonomy_level: AutonomyLevel;
  auto_promote_threshold: number; // Default: 25 consecutive approvals
  confidence_history_window: number; // Default: 30 days in milliseconds
  consecutive_approvals: number;
  last_approval_timestamp?: string;
  last_modification_timestamp?: string;
  promotion_history: AutonomyPromotionRecord[];
}

/**
 * Promotion criteria (all must be satisfied simultaneously)
 */
export interface PromotionCriteria {
  minConsecutiveApprovals: number; // Default: 25
  minDaysAtCurrentLevel: number; // Default: 30
  maxModificationRate: number; // Default: 0.05 (5%)
  maxRejectionRate: number; // Default: 0 (zero rejections allowed)
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minConsecutiveApprovals: 25,
  minDaysAtCurrentLevel: 30,
  maxModificationRate: 0.05,
  maxRejectionRate: 0
};

/**
 * Demotion triggers (any single one sufficient)
 */
export interface DemotionTrigger {
  type: 'modification' | 'rejection' | 'high_modification_rate' | 'timeout';
  description: string;
  triggers_level?: AutonomyLevel; // Demotion target level
}

/**
 * Calculate whether a gate is eligible for promotion
 */
export function checkPromotionEligibility(
  config: AutonomyGateConfig,
  decisionHistory: HITLDecisionRecord[],
  criteria: PromotionCriteria = DEFAULT_PROMOTION_CRITERIA
): { eligible: boolean; reason?: string } {
  // Can't promote from BLOCKED or AUTONOMOUS
  if (config.autonomy_level === 'BLOCKED' || config.autonomy_level === 'AUTONOMOUS') {
    return { eligible: false, reason: `Cannot promote from ${config.autonomy_level}` };
  }

  // Check consecutive approvals
  if (config.consecutive_approvals < criteria.minConsecutiveApprovals) {
    return {
      eligible: false,
      reason: `Insufficient approvals: ${config.consecutive_approvals}/${criteria.minConsecutiveApprovals}`
    };
  }

  // Check time at current level
  if (config.last_approval_timestamp) {
    const daysSinceLast = (Date.now() - new Date(config.last_approval_timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < criteria.minDaysAtCurrentLevel) {
      return {
        eligible: false,
        reason: `Insufficient time at level: ${daysSinceLast.toFixed(1)}/${criteria.minDaysAtCurrentLevel} days`
      };
    }
  }

  // Check modification rate in history window
  const windowMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  const windowStart = Date.now() - windowMs;
  const recentDecisions = decisionHistory.filter(d => new Date(d.timestamp).getTime() > windowStart);

  if (recentDecisions.length > 0) {
    const modifiedCount = recentDecisions.filter(d => d.decision === 'modified').length;
    const modificationRate = modifiedCount / recentDecisions.length;

    if (modificationRate > criteria.maxModificationRate) {
      return {
        eligible: false,
        reason: `Modification rate too high: ${(modificationRate * 100).toFixed(1)}% > ${criteria.maxModificationRate * 100}%`
      };
    }

    // Check rejection rate
    const rejectionCount = recentDecisions.filter(d => d.decision === 'rejected').length;
    if (rejectionCount > 0) {
      return { eligible: false, reason: `Gate has rejections in history window (${rejectionCount})` };
    }
  }

  return { eligible: true };
}

/**
 * Get next autonomy level (promotion target)
 */
export function getNextAutonomyLevel(currentLevel: AutonomyLevel): AutonomyLevel | null {
  const progression: Record<AutonomyLevel, AutonomyLevel | null> = {
    BLOCKED: null, // Cannot promote
    CONFIRMATIONAL: 'INFORMATIONAL',
    INFORMATIONAL: 'AUTONOMOUS',
    AUTONOMOUS: null // Already at max
  };

  return progression[currentLevel];
}

/**
 * Get demotion level (one level back, minimum CONFIRMATIONAL)
 */
export function getDemotionLevel(currentLevel: AutonomyLevel): AutonomyLevel {
  const demotion: Record<AutonomyLevel, AutonomyLevel> = {
    BLOCKED: 'BLOCKED', // Already lowest
    CONFIRMATIONAL: 'CONFIRMATIONAL', // Can't go lower
    INFORMATIONAL: 'CONFIRMATIONAL',
    AUTONOMOUS: 'INFORMATIONAL'
  };

  return demotion[currentLevel];
}

/**
 * Record a HITL decision and check for demotion triggers
 */
export function recordDecision(
  config: AutonomyGateConfig,
  decision: HITLDecision,
  operatorRole: 'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER',
  confidenceAtGate: number,
  durationMs: number,
  modificationDelta?: Record<string, unknown>
): {
  record: HITLDecisionRecord;
  demotionTriggered?: DemotionTrigger;
} {
  const record: HITLDecisionRecord = {
    decision_id: randomUUID(),
    gate_id: config.gate_id,
    agent_id: 'unknown', // Populated by caller
    decision,
    operator_role: operatorRole,
    timestamp: new Date().toISOString(),
    modification_delta: modificationDelta,
    confidence_at_gate: confidenceAtGate,
    duration_ms: durationMs,
    escalation_level: operatorRole === 'L1' ? 1 : operatorRole === 'L2' ? 2 : 3
  };

  let demotionTriggered: DemotionTrigger | undefined;

  // Check demotion triggers
  if ((decision as string) === 'modified') {
    demotionTriggered = {
      type: 'modification',
      description: 'Operator modified gate output',
      triggers_level: 'CONFIRMATIONAL' // Reset approval streak
    };
    config.consecutive_approvals = 0;
    config.last_modification_timestamp = new Date().toISOString();
  } else if ((decision as string) === 'rejected') {
    demotionTriggered = {
      type: 'rejection',
      description: 'Operator rejected gate output',
      triggers_level: 'CONFIRMATIONAL' // Immediate demotion to minimum
    };
    config.autonomy_level = 'CONFIRMATIONAL';
    config.consecutive_approvals = 0;
  } else if ((decision as string) === 'approved') {
    config.consecutive_approvals++;
    config.last_approval_timestamp = new Date().toISOString();
  }

  return { record, demotionTriggered };
}

/**
 * Create a promotion record for audit trail
 */
export function createPromotionRecord(
  config: AutonomyGateConfig,
  boardMembers: string[],
  approvalStreak: number,
  modificationRate: number
): AutonomyPromotionRecord {
  const nextLevel = getNextAutonomyLevel(config.autonomy_level);
  if (!nextLevel) {
    throw new Error(`Cannot promote from ${config.autonomy_level}`);
  }

  return {
    promotion_id: randomUUID(),
    gate_id: config.gate_id,
    from_level: config.autonomy_level,
    to_level: nextLevel,
    promotion_timestamp: new Date().toISOString(),
    board_members: boardMembers,
    approval_streak: approvalStreak,
    approval_window_days: 30,
    modification_rate: modificationRate,
    rejection_rate: 0,
    authority: boardMembers.includes('AI_SAFETY_OFFICER') ? 'AI_SAFETY_OFFICER' : 'AUTONOMY_REVIEW_BOARD',
    notes: `Promoted from ${config.autonomy_level} to ${nextLevel} based on ${approvalStreak} consecutive approvals`
  };
}

/**
 * HITL Gate configuration extension for v1.1
 *
 * Example YAML:
 *
 * ```yaml
 * hitl:
 *   - step: approve_report
 *     condition: '{{ confidence < 0.85 }}'
 *     autonomy_level: CONFIRMATIONAL
 *     auto_promote_threshold: 25
 *     confidence_history_window: 30d
 *     description: Approve weekly financial report
 * ```
 */
export interface HITLGateConfigV11 {
  gate_id: string;
  step_name: string;
  condition?: string; // Jinja expression
  autonomy_level: AutonomyLevel;
  auto_promote_threshold: number;
  confidence_history_window: string; // e.g., "30d"
  description: string;
}
