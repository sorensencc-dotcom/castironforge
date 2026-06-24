import {
  SLOThresholds,
  BurnRateWindow,
  SLOViolation,
  LatencySample,
  ErrorSample,
  SaturationSample,
} from "./SLOTypes";

export class SLOState {
  public thresholds: SLOThresholds;
  public burnRateWindows: BurnRateWindow[];
  public lastViolation: SLOViolation | null = null;
  public lastEnforcementAction: string | null = null;

  private latencySamples: LatencySample[] = [];
  private errorSamples: ErrorSample[] = [];
  private saturationSamples: SaturationSample[] = [];

  constructor(opts: {
    thresholds: SLOThresholds;
    burnRateWindows: BurnRateWindow[];
  }) {
    this.thresholds = opts.thresholds;
    this.burnRateWindows = opts.burnRateWindows;
  }

  addLatencySample(sample: LatencySample): void {
    this.latencySamples.push(sample);
    this.pruneLatency(sample.timestamp);
  }

  addErrorSample(sample: ErrorSample): void {
    this.errorSamples.push(sample);
    this.pruneErrors(sample.timestamp);
  }

  addSaturationSample(sample: SaturationSample): void {
    this.saturationSamples.push(sample);
    this.pruneSaturation(sample.timestamp);
  }

  getLatestLatency(): LatencySample | null {
    if (this.latencySamples.length === 0) return null;
    return this.latencySamples[this.latencySamples.length - 1];
  }

  getWindowErrors(windowMs: number, now: number): { errors: number; total: number } {
    let errors = 0;
    let total = 0;
    const cutoff = now - windowMs;
    for (let i = this.errorSamples.length - 1; i >= 0; i--) {
      const s = this.errorSamples[i];
      if (s.timestamp < cutoff) break;
      errors += s.errors;
      total += s.total;
    }
    return { errors, total };
  }

  getWindowSaturation(windowMs: number, now: number): number {
    let max = 0;
    const cutoff = now - windowMs;
    for (let i = this.saturationSamples.length - 1; i >= 0; i--) {
      const s = this.saturationSamples[i];
      if (s.timestamp < cutoff) break;
      if (s.value > max) max = s.value;
    }
    return max;
  }

  private pruneLatency(now: number): void {
    const cutoff = now - this.getMaxWindow();
    this.latencySamples = this.latencySamples.filter(s => s.timestamp >= cutoff);
  }

  private pruneErrors(now: number): void {
    const cutoff = now - this.getMaxWindow();
    this.errorSamples = this.errorSamples.filter(s => s.timestamp >= cutoff);
  }

  private pruneSaturation(now: number): void {
    const cutoff = now - this.getMaxWindow();
    this.saturationSamples = this.saturationSamples.filter(s => s.timestamp >= cutoff);
  }

  private getMaxWindow(): number {
    return this.burnRateWindows.reduce(
      (max, w) => (w.durationMs > max ? w.durationMs : max),
      0
    );
  }
}
