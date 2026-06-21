/**
 * H-2: Confidence History Feedback Loop
 *
 * Remediation for Gap H-2: Static HITL gates don't learn from confidence patterns.
 * Feedback loop maps actual gate outcomes (accept/reject/modify) to predicted confidence,
 * enabling confidence score recalibration and per-agent trend detection.
 */

export interface ConfidenceObservation {
  prediction_id: string;
  agent_id: string;
  gate_id: string;
  predicted_confidence: number;
  actual_outcome: 'approved' | 'rejected' | 'modified';
  operator_role: 'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER';
  observation_timestamp: string;
  delta: number; // actual_outcome confidence value minus predicted_confidence
}

export interface ConfidenceCalibration {
  agent_id: string;
  gate_id: string;
  observation_count: number;
  mean_error: number; // Absolute mean error between predictions and outcomes
  variance: number;
  confidence_bins: Record<string, { count: number; approval_rate: number }>; // e.g., "0.7-0.8": { count: 50, approval_rate: 0.92 }
  last_calibrated: string;
}

/**
 * Outcome confidence values (for calculating delta)
 */
const OUTCOME_CONFIDENCE: Record<'approved' | 'rejected' | 'modified', number> = {
  approved: 1.0,
  rejected: 0.0,
  modified: 0.5 // Partial acceptance
};

/**
 * Record a confidence observation from a HITL gate decision
 */
export function recordConfidenceObservation(
  predictionId: string,
  agentId: string,
  gateId: string,
  predictedConfidence: number,
  actualOutcome: 'approved' | 'rejected' | 'modified',
  operatorRole: 'L1' | 'L2' | 'L3' | 'AI_SAFETY_OFFICER'
): ConfidenceObservation {
  const outcomeConfidence = OUTCOME_CONFIDENCE[actualOutcome];
  return {
    prediction_id: predictionId,
    agent_id: agentId,
    gate_id: gateId,
    predicted_confidence: predictedConfidence,
    actual_outcome: actualOutcome,
    operator_role: operatorRole,
    observation_timestamp: new Date().toISOString(),
    delta: outcomeConfidence - predictedConfidence
  };
}

/**
 * Compute calibration metrics from observation history
 */
export function computeCalibration(
  observations: ConfidenceObservation[]
): ConfidenceCalibration | null {
  if (observations.length === 0) {
    return null;
  }

  const agentId = observations[0].agent_id;
  const gateId = observations[0].gate_id;

  // Mean absolute error
  const absoluteErrors = observations.map(o => Math.abs(o.delta));
  const meanError = absoluteErrors.reduce((a, b) => a + b, 0) / absoluteErrors.length;

  // Variance
  const variance =
    absoluteErrors.reduce((sum, err) => sum + Math.pow(err - meanError, 2), 0) / absoluteErrors.length;

  // Bin predictions: 0.0-0.1, 0.1-0.2, ..., 0.9-1.0
  const bins: Record<string, ConfidenceObservation[]> = {};
  for (let i = 0; i < 10; i++) {
    const lower = i / 10;
    const upper = (i + 1) / 10;
    const key = `${lower.toFixed(1)}-${upper.toFixed(1)}`;
    bins[key] = observations.filter(o => o.predicted_confidence >= lower && o.predicted_confidence < upper);
  }

  // Compute approval rate per bin
  const confidenceBins: Record<string, { count: number; approval_rate: number }> = {};
  for (const [key, binObservations] of Object.entries(bins)) {
    if (binObservations.length > 0) {
      const approvalCount = binObservations.filter(o => o.actual_outcome === 'approved').length;
      confidenceBins[key] = {
        count: binObservations.length,
        approval_rate: approvalCount / binObservations.length
      };
    }
  }

  return {
    agent_id: agentId,
    gate_id: gateId,
    observation_count: observations.length,
    mean_error: meanError,
    variance,
    confidence_bins: confidenceBins,
    last_calibrated: new Date().toISOString()
  };
}

/**
 * Detect confidence trends per agent (e.g., overconfident, underconfident)
 */
export interface ConfidenceTrend {
  agent_id: string;
  trend_type: 'overconfident' | 'underconfident' | 'well_calibrated';
  mean_delta: number;
  recent_bias: number; // Bias in last N observations
  recommendation: string;
}

export function detectConfidenceTrend(calibration: ConfidenceCalibration): ConfidenceTrend {
  const meanDelta = Object.values(calibration.confidence_bins).reduce((sum, bin) => {
    return sum + bin.count * (bin.approval_rate - 0.5);
  }, 0) / calibration.observation_count;

  let trendType: 'overconfident' | 'underconfident' | 'well_calibrated';
  let recommendation: string;

  if (meanDelta > 0.15) {
    trendType = 'overconfident';
    recommendation = `Agent ${calibration.agent_id} tends to over-estimate confidence. Consider lowering confidence threshold by ~${Math.round(meanDelta * 100)}%.`;
  } else if (meanDelta < -0.15) {
    trendType = 'underconfident';
    recommendation = `Agent ${calibration.agent_id} tends to under-estimate confidence. Consider raising confidence threshold by ~${Math.round(Math.abs(meanDelta) * 100)}%.`;
  } else {
    trendType = 'well_calibrated';
    recommendation = `Agent ${calibration.agent_id} confidence predictions are well-calibrated.`;
  }

  return {
    agent_id: calibration.agent_id,
    trend_type: trendType,
    mean_delta: meanDelta,
    recent_bias: 0, // Would compute from recent subset
    recommendation
  };
}

/**
 * Confidence recalibration function: adjust gate threshold based on historical bias
 */
export function recalibrateConfidenceThreshold(
  currentThreshold: number,
  calibration: ConfidenceCalibration,
  aggressiveness: number = 0.5 // 0-1, how much to adjust
): number {
  // Compute aggregate bias
  let totalBias = 0;
  let totalCount = 0;
  for (const [binKey, binStats] of Object.entries(calibration.confidence_bins)) {
    // Approval rate should be close to predicted confidence
    const [lower, upper] = binKey.split('-').map(Number);
    const midpoint = (lower + upper) / 2;
    const binBias = binStats.approval_rate - midpoint;
    totalBias += binBias * binStats.count;
    totalCount += binStats.count;
  }

  const avgBias = totalCount > 0 ? totalBias / totalCount : 0;
  const adjustment = avgBias * aggressiveness;

  return Math.max(0, Math.min(1, currentThreshold - adjustment)); // Clamp to [0, 1]
}
