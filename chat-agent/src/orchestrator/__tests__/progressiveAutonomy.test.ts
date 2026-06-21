/**
 * H-1: Progressive Autonomy Framework — Integration Tests
 *
 * Validates trust-based HITL gate tier promotion with demonstrated reliability history,
 * formal AutonomyReviewBoard governance, and immutable audit trails.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  checkPromotionEligibility,
  getNextAutonomyLevel,
  getDemotionLevel,
  recordDecision,
  createPromotionRecord,
  AutonomyGateConfig,
  HITLDecisionRecord,
  AutonomyLevel,
  PromotionCriteria,
  DEFAULT_PROMOTION_CRITERIA
} from '../progressiveAutonomy';

describe('H-1: Progressive Autonomy Framework', () => {
  let gateConfig: AutonomyGateConfig;

  beforeEach(() => {
    gateConfig = {
      gate_id: 'test-gate-1',
      autonomy_level: 'CONFIRMATIONAL' as AutonomyLevel,
      auto_promote_threshold: 25,
      confidence_history_window: 30 * 24 * 60 * 60 * 1000,
      consecutive_approvals: 0,
      promotion_history: []
    };
  });

  describe('Gate Autonomy Progression', () => {
    it('should move from BLOCKED to CONFIRMATIONAL (entry point)', () => {
      gateConfig.autonomy_level = 'BLOCKED';
      const next = getNextAutonomyLevel(gateConfig.autonomy_level);
      expect(next).toBeNull(); // BLOCKED cannot promote
    });

    it('should progress CONFIRMATIONAL → INFORMATIONAL → AUTONOMOUS', () => {
      expect(getNextAutonomyLevel('CONFIRMATIONAL')).toBe('INFORMATIONAL');
      expect(getNextAutonomyLevel('INFORMATIONAL')).toBe('AUTONOMOUS');
      expect(getNextAutonomyLevel('AUTONOMOUS')).toBeNull(); // At max
    });

    it('should demote one level (minimum CONFIRMATIONAL)', () => {
      expect(getDemotionLevel('AUTONOMOUS')).toBe('INFORMATIONAL');
      expect(getDemotionLevel('INFORMATIONAL')).toBe('CONFIRMATIONAL');
      expect(getDemotionLevel('CONFIRMATIONAL')).toBe('CONFIRMATIONAL'); // Lowest
      expect(getDemotionLevel('BLOCKED')).toBe('BLOCKED');
    });
  });

  describe('Promotion Eligibility', () => {
    it('should reject promotion from BLOCKED or AUTONOMOUS', () => {
      gateConfig.autonomy_level = 'BLOCKED';
      let result = checkPromotionEligibility(gateConfig, []);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Cannot promote');

      gateConfig.autonomy_level = 'AUTONOMOUS';
      result = checkPromotionEligibility(gateConfig, []);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Cannot promote');
    });

    it('should require minimum consecutive approvals (default: 25)', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 24; // One short
      const result = checkPromotionEligibility(gateConfig, []);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient approvals');
      expect(result.reason).toContain('24/25');
    });

    it('should require minimum time at current level (default: 30 days)', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 25; // Meets approval threshold
      gateConfig.last_approval_timestamp = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days ago
      const result = checkPromotionEligibility(gateConfig, []);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Insufficient time at level');
    });

    it('should reject if modification rate exceeds threshold (>5%)', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 25;
      gateConfig.last_approval_timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago

      // Create 100 decisions: 10 modifications (10% rate, exceeds 5% threshold)
      const decisions: HITLDecisionRecord[] = [];
      for (let i = 0; i < 90; i++) {
        decisions.push({
          decision_id: `d-${i}`,
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'approved',
          operator_role: 'L1',
          timestamp: new Date().toISOString(),
          confidence_at_gate: 0.95,
          duration_ms: 500,
          escalation_level: 1
        });
      }
      for (let i = 90; i < 100; i++) {
        decisions.push({
          decision_id: `d-${i}`,
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'modified',
          operator_role: 'L2',
          timestamp: new Date().toISOString(),
          modification_delta: { field: 'value' },
          confidence_at_gate: 0.75,
          duration_ms: 1200,
          escalation_level: 2
        });
      }

      const result = checkPromotionEligibility(gateConfig, decisions);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Modification rate too high');
    });

    it('should reject if any rejections exist in history window', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 25;
      gateConfig.last_approval_timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      const decisions: HITLDecisionRecord[] = [
        {
          decision_id: 'd-1',
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'approved',
          operator_role: 'L1',
          timestamp: new Date().toISOString(),
          confidence_at_gate: 0.95,
          duration_ms: 500,
          escalation_level: 1
        },
        {
          decision_id: 'd-2',
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'rejected',
          operator_role: 'AI_SAFETY_OFFICER',
          timestamp: new Date().toISOString(),
          confidence_at_gate: 0.3,
          duration_ms: 2000,
          escalation_level: 3
        }
      ];

      const result = checkPromotionEligibility(gateConfig, decisions);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('rejections');
    });

    it('should approve promotion when all criteria met', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 25;
      gateConfig.last_approval_timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      const decisions: HITLDecisionRecord[] = [];
      for (let i = 0; i < 100; i++) {
        decisions.push({
          decision_id: `d-${i}`,
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'approved',
          operator_role: 'L1',
          timestamp: new Date().toISOString(),
          confidence_at_gate: 0.95,
          duration_ms: 500,
          escalation_level: 1
        });
      }

      const result = checkPromotionEligibility(gateConfig, decisions);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should support custom promotion criteria', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 10; // Less than default 25

      const customCriteria: PromotionCriteria = {
        minConsecutiveApprovals: 10, // Relaxed
        minDaysAtCurrentLevel: 7,
        maxModificationRate: 0.1,
        maxRejectionRate: 0
      };

      gateConfig.last_approval_timestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      const decisions: HITLDecisionRecord[] = [];
      for (let i = 0; i < 50; i++) {
        decisions.push({
          decision_id: `d-${i}`,
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'approved',
          operator_role: 'L1',
          timestamp: new Date().toISOString(),
          confidence_at_gate: 0.9,
          duration_ms: 400,
          escalation_level: 1
        });
      }

      const result = checkPromotionEligibility(gateConfig, decisions, customCriteria);
      expect(result.eligible).toBe(true);
    });
  });

  describe('HITL Decision Recording & Audit Trail', () => {
    it('should create audit trail record on approval', () => {
      const { record, demotionTriggered } = recordDecision(
        gateConfig,
        'approved',
        'L1',
        0.95,
        500
      );

      expect(record.decision_id).toBeDefined();
      expect(record.gate_id).toBe(gateConfig.gate_id);
      expect(record.decision).toBe('approved');
      expect(record.operator_role).toBe('L1');
      expect(record.confidence_at_gate).toBe(0.95);
      expect(record.duration_ms).toBe(500);
      expect(record.timestamp).toBeDefined();
      expect(demotionTriggered).toBeUndefined();
    });

    it('should increment consecutive_approvals on approval', () => {
      const initialCount = gateConfig.consecutive_approvals;
      recordDecision(gateConfig, 'approved', 'L1', 0.9, 400);
      expect(gateConfig.consecutive_approvals).toBe(initialCount + 1);
    });

    it('should trigger demotion on modification', () => {
      gateConfig.consecutive_approvals = 20;
      const { record, demotionTriggered } = recordDecision(
        gateConfig,
        'modified',
        'L2',
        0.75,
        1200,
        { field_name: 'old_value', new_value: 'modified_value' }
      );

      expect(record.decision).toBe('modified');
      expect(record.modification_delta).toBeDefined();
      expect(demotionTriggered).toBeDefined();
      expect(demotionTriggered?.type).toBe('modification');
      expect(gateConfig.consecutive_approvals).toBe(0); // Reset
      expect(gateConfig.last_modification_timestamp).toBeDefined();
    });

    it('should trigger demotion on rejection and move to CONFIRMATIONAL', () => {
      gateConfig.autonomy_level = 'AUTONOMOUS';
      gateConfig.consecutive_approvals = 50;

      const { record, demotionTriggered } = recordDecision(
        gateConfig,
        'rejected',
        'AI_SAFETY_OFFICER',
        0.2,
        3000
      );

      expect(record.decision).toBe('rejected');
      expect(demotionTriggered).toBeDefined();
      expect(demotionTriggered?.type).toBe('rejection');
      expect(gateConfig.autonomy_level).toBe('CONFIRMATIONAL'); // Immediate demotion
      expect(gateConfig.consecutive_approvals).toBe(0); // Reset
    });

    it('should track operator escalation level', () => {
      const roles: Array<'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER'> = ['L1', 'L2', 'L3', 'AI_SAFETY_OFFICER'];
      const expectedLevels = [1, 2, 3, 3];

      roles.forEach((role, idx) => {
        const { record } = recordDecision(gateConfig, 'approved', role, 0.9, 300);
        expect(record.escalation_level).toBe(expectedLevels[idx]);
      });
    });
  });

  describe('Promotion Record & Governance', () => {
    it('should create promotion record with board signatures', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      const boardMembers = ['safety-officer-1', 'ai-lead', 'ops-lead'];

      const promotionRecord = createPromotionRecord(gateConfig, boardMembers, 25, 0.02);

      expect(promotionRecord.promotion_id).toBeDefined();
      expect(promotionRecord.gate_id).toBe(gateConfig.gate_id);
      expect(promotionRecord.from_level).toBe('CONFIRMATIONAL');
      expect(promotionRecord.to_level).toBe('INFORMATIONAL');
      expect(promotionRecord.board_members).toEqual(boardMembers);
      expect(promotionRecord.approval_streak).toBe(25);
      expect(promotionRecord.modification_rate).toBe(0.02);
      expect(promotionRecord.promotion_timestamp).toBeDefined();
    });

    it('should set authority to AI_SAFETY_OFFICER if present', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      const boardWithSafety = ['AI_SAFETY_OFFICER', 'ops-lead'];

      const record = createPromotionRecord(gateConfig, boardWithSafety, 25, 0.01);
      expect(record.authority).toBe('AI_SAFETY_OFFICER');
    });

    it('should set authority to AUTONOMY_REVIEW_BOARD if no safety officer', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      const boardWithoutSafety = ['ops-lead', 'senior-engineer'];

      const record = createPromotionRecord(gateConfig, boardWithoutSafety, 25, 0.01);
      expect(record.authority).toBe('AUTONOMY_REVIEW_BOARD');
    });

    it('should reject promotion from AUTONOMOUS', () => {
      gateConfig.autonomy_level = 'AUTONOMOUS';
      expect(() => {
        createPromotionRecord(gateConfig, ['safety-officer'], 50, 0.0);
      }).toThrow('Cannot promote from AUTONOMOUS');
    });

    it('should append to promotion_history', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.promotion_history = [];

      const record1 = createPromotionRecord(gateConfig, ['safety-officer'], 25, 0.01);
      gateConfig.promotion_history.push(record1);
      gateConfig.autonomy_level = 'INFORMATIONAL';

      const record2 = createPromotionRecord(gateConfig, ['safety-officer'], 30, 0.02);
      gateConfig.promotion_history.push(record2);

      expect(gateConfig.promotion_history).toHaveLength(2);
      expect(gateConfig.promotion_history[0].to_level).toBe('INFORMATIONAL');
      expect(gateConfig.promotion_history[1].to_level).toBe('AUTONOMOUS');
    });
  });

  describe('Production Scenarios', () => {
    it('should execute full promotion workflow: CONFIRMATIONAL → INFORMATIONAL', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 25; // Already met approval threshold

      // Set last approval to 31 days ago
      gateConfig.last_approval_timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      // Build decision history within 30-day window
      const decisionHistory: HITLDecisionRecord[] = [];
      const baseTime = Date.now() - 29 * 24 * 60 * 60 * 1000; // 29 days ago (within window)

      for (let i = 0; i < 25; i++) {
        decisionHistory.push({
          decision_id: `d-${i}`,
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'approved',
          operator_role: 'L1',
          timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000).toISOString(),
          confidence_at_gate: 0.92,
          duration_ms: 450,
          escalation_level: 1
        });
      }

      // Check eligibility
      const eligibility = checkPromotionEligibility(gateConfig, decisionHistory);
      expect(eligibility.eligible).toBe(true);

      // Create promotion record
      const promotionRecord = createPromotionRecord(
        gateConfig,
        ['AI_SAFETY_OFFICER', 'ops-lead'],
        25,
        0.0
      );

      expect(promotionRecord.from_level).toBe('CONFIRMATIONAL');
      expect(promotionRecord.to_level).toBe('INFORMATIONAL');
      expect(promotionRecord.authority).toBe('AI_SAFETY_OFFICER');
    });

    it('should detect and recover from modification spike', () => {
      gateConfig.autonomy_level = 'AUTONOMOUS';
      gateConfig.consecutive_approvals = 50;

      // Simulate a modification
      const { demotionTriggered } = recordDecision(gateConfig, 'modified', 'L3', 0.8, 1500, {
        safety_check: 'added'
      });

      expect(demotionTriggered?.type).toBe('modification');
      expect(gateConfig.autonomy_level).toBe('AUTONOMOUS'); // Level unchanged for modification
      expect(gateConfig.consecutive_approvals).toBe(0); // Counter reset after modification

      // Recovery: record 30 more approvals to exceed promotion threshold
      for (let i = 0; i < 30; i++) {
        recordDecision(gateConfig, 'approved', 'L1', 0.94, 400);
      }

      // Verify recovery metrics
      expect(gateConfig.consecutive_approvals).toBe(30); // Rebuilt counter
      expect(gateConfig.last_modification_timestamp).toBeDefined(); // Tracks spike time
    });

    it('should enforce zero-rejection policy for promotion', () => {
      gateConfig.autonomy_level = 'CONFIRMATIONAL';
      gateConfig.consecutive_approvals = 25;
      gateConfig.last_approval_timestamp = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

      // 24 approvals + 1 rejection
      const decisions: HITLDecisionRecord[] = [];
      for (let i = 0; i < 24; i++) {
        decisions.push({
          decision_id: `d-${i}`,
          gate_id: gateConfig.gate_id,
          agent_id: 'agent-1',
          decision: 'approved',
          operator_role: 'L1',
          timestamp: new Date().toISOString(),
          confidence_at_gate: 0.95,
          duration_ms: 400,
          escalation_level: 1
        });
      }
      decisions.push({
        decision_id: 'd-reject',
        gate_id: gateConfig.gate_id,
        agent_id: 'agent-1',
        decision: 'rejected',
        operator_role: 'L3',
        timestamp: new Date().toISOString(),
        confidence_at_gate: 0.1,
        duration_ms: 3000,
        escalation_level: 3
      });

      const result = checkPromotionEligibility(gateConfig, decisions);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('rejections');
    });
  });
});
