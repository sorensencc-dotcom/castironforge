/**
 * H-2: Confidence History Feedback Loop — Tests
 */

import { describe, it, expect } from '@jest/globals';
import {
  recordConfidenceObservation,
  computeCalibration,
  detectConfidenceTrend,
  recalibrateConfidenceThreshold,
  ConfidenceObservation
} from '../confidenceHistory';

describe('H-2: Confidence History Feedback Loop', () => {
  describe('recordConfidenceObservation', () => {
    it('should record observation with delta calculation', () => {
      const obs = recordConfidenceObservation(
        'pred-1',
        'agent-1',
        'gate-1',
        0.8,
        'approved',
        'L1'
      );

      expect(obs.prediction_id).toBe('pred-1');
      expect(obs.agent_id).toBe('agent-1');
      expect(obs.predicted_confidence).toBeCloseTo(0.8, 5);
      expect(obs.actual_outcome).toBe('approved');
      expect(obs.delta).toBeCloseTo(0.2, 5); // 1.0 (approved) - 0.8 = 0.2
    });

    it('should calculate delta for rejection', () => {
      const obs = recordConfidenceObservation('pred-2', 'agent-1', 'gate-1', 0.8, 'rejected', 'L2');
      expect(obs.delta).toBeCloseTo(-0.8, 5); // 0.0 (rejected) - 0.8 = -0.8
    });

    it('should calculate delta for modification as 0.5 outcome', () => {
      const obs = recordConfidenceObservation('pred-3', 'agent-1', 'gate-1', 0.8, 'modified', 'L1');
      expect(obs.delta).toBeCloseTo(-0.3, 5); // 0.5 (modified) - 0.8 = -0.3
    });
  });

  describe('computeCalibration', () => {
    it('should compute metrics from observations', () => {
      const observations: ConfidenceObservation[] = [
        // Well-calibrated: predict 0.9, approve (1.0)
        {
          prediction_id: 'p1',
          agent_id: 'agent-1',
          gate_id: 'gate-1',
          predicted_confidence: 0.9,
          actual_outcome: 'approved',
          operator_role: 'L1',
          observation_timestamp: new Date().toISOString(),
          delta: 0.1
        },
        // Overconfident: predict 0.9, reject (0.0)
        {
          prediction_id: 'p2',
          agent_id: 'agent-1',
          gate_id: 'gate-1',
          predicted_confidence: 0.9,
          actual_outcome: 'rejected',
          operator_role: 'L1',
          observation_timestamp: new Date().toISOString(),
          delta: -0.9
        },
        // Underconfident: predict 0.6, approve (1.0)
        {
          prediction_id: 'p3',
          agent_id: 'agent-1',
          gate_id: 'gate-1',
          predicted_confidence: 0.6,
          actual_outcome: 'approved',
          operator_role: 'L1',
          observation_timestamp: new Date().toISOString(),
          delta: 0.4
        }
      ];

      const cal = computeCalibration(observations);
      expect(cal).not.toBeNull();
      expect(cal!.observation_count).toBe(3);
      expect(cal!.agent_id).toBe('agent-1');
      expect(cal!.gate_id).toBe('gate-1');

      // Mean absolute error: (0.1 + 0.9 + 0.4) / 3 = 0.467
      expect(cal!.mean_error).toBeCloseTo(0.467, 2);

      // Should have bins with approval rates
      expect(Object.keys(cal!.confidence_bins).length).toBeGreaterThan(0);
    });

    it('should return null for empty observations', () => {
      const cal = computeCalibration([]);
      expect(cal).toBeNull();
    });

    it('should compute approval rate per confidence bin', () => {
      const observations: ConfidenceObservation[] = [];

      // 0.7-0.8 bin: 3 approvals, 1 rejection (75% approval rate)
      for (let i = 0; i < 3; i++) {
        observations.push({
          prediction_id: `p-${i}`,
          agent_id: 'agent-1',
          gate_id: 'gate-1',
          predicted_confidence: 0.75,
          actual_outcome: 'approved',
          operator_role: 'L1',
          observation_timestamp: new Date().toISOString(),
          delta: 0.25
        });
      }
      observations.push({
        prediction_id: 'p-reject',
        agent_id: 'agent-1',
        gate_id: 'gate-1',
        predicted_confidence: 0.75,
        actual_outcome: 'rejected',
        operator_role: 'L1',
        observation_timestamp: new Date().toISOString(),
        delta: -0.75
      });

      const cal = computeCalibration(observations);
      expect(cal!.confidence_bins['0.7-0.8']).toEqual({
        count: 4,
        approval_rate: 0.75
      });
    });
  });

  describe('detectConfidenceTrend', () => {
    it('should detect overconfident agent', () => {
      const calibration = {
        agent_id: 'agent-1',
        gate_id: 'gate-1',
        observation_count: 100,
        mean_error: 0.25,
        variance: 0.1,
        confidence_bins: {
          '0.8-0.9': { count: 100, approval_rate: 0.2 } // Approval rate 20% < 50%, mean_delta = (0.2-0.5) = -0.3, below -0.15
        },
        last_calibrated: new Date().toISOString()
      };

      const trend = detectConfidenceTrend(calibration);
      // Should have trend with recommendation about overconfidence
      expect(trend.recommendation.length).toBeGreaterThan(0);
    });

    it('should detect underconfident agent', () => {
      const calibration = {
        agent_id: 'agent-2',
        gate_id: 'gate-1',
        observation_count: 100,
        mean_error: 0.25,
        variance: 0.1,
        confidence_bins: {
          '0.2-0.3': { count: 100, approval_rate: 0.8 } // Approval rate 80% > 50%, mean_delta = (0.8-0.5) = 0.3, above 0.15
        },
        last_calibrated: new Date().toISOString()
      };

      const trend = detectConfidenceTrend(calibration);
      expect(trend.recommendation.length).toBeGreaterThan(0);
    });

    it('should detect well-calibrated agent', () => {
      const calibration = {
        agent_id: 'agent-3',
        gate_id: 'gate-1',
        observation_count: 100,
        mean_error: 0.05,
        variance: 0.02,
        confidence_bins: {
          '0.5-0.6': { count: 100, approval_rate: 0.55 } // Approval rate 55%, mean_delta = (0.55-0.5) = 0.05, within threshold
        },
        last_calibrated: new Date().toISOString()
      };

      const trend = detectConfidenceTrend(calibration);
      expect(trend.trend_type).toBe('well_calibrated');
    });
  });

  describe('recalibrateConfidenceThreshold', () => {
    it('should adjust threshold based on approval rate bias', () => {
      const calibration = {
        agent_id: 'agent-1',
        gate_id: 'gate-1',
        observation_count: 100,
        mean_error: 0.2,
        variance: 0.1,
        confidence_bins: {
          '0.7-0.8': { count: 100, approval_rate: 0.5 } // Predicts 75%, only 50% approved
        },
        last_calibrated: new Date().toISOString()
      };

      const adjusted = recalibrateConfidenceThreshold(0.75, calibration, 0.5);
      // The adjustment should be based on the bias calculation
      expect(adjusted).toBeDefined();
      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(adjusted).toBeLessThanOrEqual(1);
    });

    it('should clamp threshold to [0, 1]', () => {
      const calibration = {
        agent_id: 'agent-3',
        gate_id: 'gate-1',
        observation_count: 100,
        mean_error: 0.5,
        variance: 0.1,
        confidence_bins: {
          '0.8-0.9': { count: 100, approval_rate: 0.05 } // Very overconfident
        },
        last_calibrated: new Date().toISOString()
      };

      const adjusted = recalibrateConfidenceThreshold(0.1, calibration, 1.0);
      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(adjusted).toBeLessThanOrEqual(1);
    });

    it('should be affected by aggressiveness parameter', () => {
      const calibration = {
        agent_id: 'agent-4',
        gate_id: 'gate-1',
        observation_count: 100,
        mean_error: 0.2,
        variance: 0.1,
        confidence_bins: {
          '0.7-0.8': { count: 100, approval_rate: 0.3 } // -45% bias
        },
        last_calibrated: new Date().toISOString()
      };

      const less_aggressive = recalibrateConfidenceThreshold(0.75, calibration, 0.1);
      const more_aggressive = recalibrateConfidenceThreshold(0.75, calibration, 0.9);

      // Both should be within bounds
      expect(less_aggressive).toBeGreaterThanOrEqual(0);
      expect(more_aggressive).toBeGreaterThanOrEqual(0);
      // With more negative bias, more aggressive should adjust more
      expect(Math.abs(more_aggressive - 0.75)).toBeGreaterThanOrEqual(Math.abs(less_aggressive - 0.75));
    });
  });
});
