import { SLOState } from "./SLOState";
import {
  SLOViolation,
  SLODomain,
  EnforcementAction,
  BurnRateWindow,
} from "./SLOTypes";

export class SLOController {
  private state: SLOState;

  constructor(state: SLOState) {
    this.state = state;
  }

  evaluateLatency(): SLOViolation | null {
    const sample = this.state.getLatestLatency();
    if (!sample) return null;

    const { latencyP50, latencyP90, latencyP99 } = this.state.thresholds;
    let severity = 0;
    let message = "";

    if (sample.p99 > latencyP99) {
      severity = 3;
      message = `p99 latency ${sample.p99} exceeds threshold ${latencyP99}`;
    } else if (sample.p90 > latencyP90) {
      severity = 2;
      message = `p90 latency ${sample.p90} exceeds threshold ${latencyP90}`;
    } else if (sample.p50 > latencyP50) {
      severity = 1;
      message = `p50 latency ${sample.p50} exceeds threshold ${latencyP50}`;
    } else {
      return null;
    }

    const violation: SLOViolation = {
      domain: SLODomain.Latency,
      severity,
      message,
      timestamp: sample.timestamp,
    };

    this.state.lastViolation = violation;
    return violation;
  }

  evaluateErrorRate(now: number = Date.now()): SLOViolation | null {
    const threshold = this.state.thresholds.errorRate;
    const window = this.state.burnRateWindows[0];
    const { errors, total } = this.state.getWindowErrors(window.durationMs, now);
    if (total === 0) return null;

    const rate = errors / total;
    if (rate <= threshold) return null;

    const violation: SLOViolation = {
      domain: SLODomain.ErrorRate,
      severity: rate > threshold * 2 ? 3 : rate > threshold * 1.5 ? 2 : 1,
      message: `error rate ${rate.toFixed(4)} exceeds threshold ${threshold}`,
      timestamp: now,
    };

    this.state.lastViolation = violation;
    return violation;
  }

  evaluateSaturation(now: number = Date.now()): SLOViolation | null {
    const threshold = this.state.thresholds.saturation;
    const window = this.state.burnRateWindows[0];
    const max = this.state.getWindowSaturation(window.durationMs, now);

    if (max <= threshold) return null;

    const violation: SLOViolation = {
      domain: SLODomain.Saturation,
      severity: max > threshold * 2 ? 3 : max > threshold * 1.5 ? 2 : 1,
      message: `saturation ${max.toFixed(4)} exceeds threshold ${threshold}`,
      timestamp: now,
    };

    this.state.lastViolation = violation;
    return violation;
  }

  computeBurnRate(now: number = Date.now()): number {
    let maxBurn = 0;
    for (const w of this.state.burnRateWindows) {
      const { errors } = this.state.getWindowErrors(w.durationMs, now);
      const burn = w.allowedErrors === 0 ? 0 : errors / w.allowedErrors;
      if (burn > maxBurn) maxBurn = burn;
    }
    return maxBurn;
  }

  shouldEnforce(violation: SLOViolation | null, now: number = Date.now()): boolean {
    if (!violation) return false;
    const burn = this.computeBurnRate(now);
    if (burn < 1.0) return false;
    return violation.severity >= 2;
  }

  enforce(action: EnforcementAction, violation: SLOViolation): void {
    this.state.lastEnforcementAction = action;
    this.state.lastViolation = violation;
  }
}
