import { SLOState } from "../SLOState";
import { SLOThresholds, BurnRateWindow } from "../SLOTypes";

describe("SLOState", () => {
  let state: SLOState;

  const defaultThresholds: SLOThresholds = {
    latencyP50: 100,
    latencyP90: 200,
    latencyP99: 500,
    errorRate: 0.01,
    saturation: 0.8,
  };

  const defaultWindows: BurnRateWindow[] = [
    { durationMs: 60000, allowedErrors: 100 },
    { durationMs: 300000, allowedErrors: 400 },
  ];

  beforeEach(() => {
    state = new SLOState({
      thresholds: defaultThresholds,
      burnRateWindows: defaultWindows,
    });
  });

  describe("constructor", () => {
    it("initializes with provided thresholds", () => {
      expect(state.thresholds).toBe(defaultThresholds);
    });

    it("initializes with provided burn rate windows", () => {
      expect(state.burnRateWindows).toBe(defaultWindows);
    });

    it("initializes lastViolation and lastEnforcementAction to null", () => {
      expect(state.lastViolation).toBeNull();
      expect(state.lastEnforcementAction).toBeNull();
    });
  });

  describe("latency samples", () => {
    it("stores and retrieves latency samples", () => {
      const sample = { p50: 50, p90: 100, p99: 200, timestamp: Date.now() };
      state.addLatencySample(sample);
      const latest = state.getLatestLatency();
      expect(latest).toEqual(sample);
    });

    it("returns null when no latency samples exist", () => {
      expect(state.getLatestLatency()).toBeNull();
    });

    it("returns the most recent latency sample", () => {
      const now = Date.now();
      state.addLatencySample({ p50: 50, p90: 100, p99: 200, timestamp: now });
      state.addLatencySample({
        p50: 60,
        p90: 110,
        p99: 210,
        timestamp: now + 1000,
      });
      const latest = state.getLatestLatency();
      expect(latest!.p50).toBe(60);
    });

    it("prunes old latency samples", () => {
      const now = Date.now();
      const maxWindow = Math.max(...defaultWindows.map(w => w.durationMs));
      state.addLatencySample({
        p50: 50,
        p90: 100,
        p99: 200,
        timestamp: now - maxWindow - 10000,
      });
      state.addLatencySample({
        p50: 55,
        p90: 105,
        p99: 205,
        timestamp: now,
      });
      const latest = state.getLatestLatency();
      expect(latest!.p50).toBe(55);
    });
  });

  describe("error samples", () => {
    it("accumulates error samples within window", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 10, total: 1000, timestamp: now });
      state.addErrorSample({ errors: 5, total: 500, timestamp: now + 1000 });
      const windowData = state.getWindowErrors(60000, now + 2000);
      expect(windowData.errors).toBe(15);
      expect(windowData.total).toBe(1500);
    });

    it("returns zero when no samples in window", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 10,
        total: 1000,
        timestamp: now - 100000,
      });
      const windowData = state.getWindowErrors(60000, now);
      expect(windowData.errors).toBe(0);
      expect(windowData.total).toBe(0);
    });

    it("respects window boundary", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 10, total: 1000, timestamp: now - 70000 });
      state.addErrorSample({ errors: 5, total: 500, timestamp: now });
      const windowData = state.getWindowErrors(60000, now);
      expect(windowData.errors).toBe(5);
      expect(windowData.total).toBe(500);
    });

    it("prunes old error samples", () => {
      const now = Date.now();
      const maxWindow = Math.max(...defaultWindows.map(w => w.durationMs));
      state.addErrorSample({
        errors: 100,
        total: 10000,
        timestamp: now - maxWindow - 10000,
      });
      state.addErrorSample({ errors: 5, total: 500, timestamp: now });
      const windowData = state.getWindowErrors(maxWindow, now);
      expect(windowData.errors).toBe(5);
      expect(windowData.total).toBe(500);
    });
  });

  describe("saturation samples", () => {
    it("tracks maximum saturation in window", () => {
      const now = Date.now();
      state.addSaturationSample({ value: 0.5, timestamp: now });
      state.addSaturationSample({ value: 0.7, timestamp: now + 1000 });
      state.addSaturationSample({ value: 0.6, timestamp: now + 2000 });
      const maxSaturation = state.getWindowSaturation(60000, now + 3000);
      expect(maxSaturation).toBe(0.7);
    });

    it("returns 0 when no samples in window", () => {
      const now = Date.now();
      state.addSaturationSample({
        value: 0.9,
        timestamp: now - 100000,
      });
      const maxSaturation = state.getWindowSaturation(60000, now);
      expect(maxSaturation).toBe(0);
    });

    it("respects window boundary", () => {
      const now = Date.now();
      state.addSaturationSample({ value: 0.95, timestamp: now - 70000 });
      state.addSaturationSample({ value: 0.5, timestamp: now });
      const maxSaturation = state.getWindowSaturation(60000, now);
      expect(maxSaturation).toBe(0.5);
    });

    it("prunes old saturation samples", () => {
      const now = Date.now();
      const maxWindow = Math.max(...defaultWindows.map(w => w.durationMs));
      state.addSaturationSample({
        value: 0.99,
        timestamp: now - maxWindow - 10000,
      });
      state.addSaturationSample({ value: 0.5, timestamp: now });
      const maxSaturation = state.getWindowSaturation(maxWindow, now);
      expect(maxSaturation).toBe(0.5);
    });
  });

  describe("multiple window queries", () => {
    it("supports different window sizes simultaneously", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 10,
        total: 1000,
        timestamp: now - 150000,
      });
      state.addErrorSample({
        errors: 20,
        total: 2000,
        timestamp: now,
      });
      const window1 = state.getWindowErrors(60000, now);
      const window2 = state.getWindowErrors(300000, now);
      expect(window1.errors).toBe(20);
      expect(window2.errors).toBe(30);
    });
  });

  describe("violation and enforcement state", () => {
    it("stores lastViolation", () => {
      const violation = {
        domain: "error_rate" as const,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      };
      state.lastViolation = violation;
      expect(state.lastViolation).toBe(violation);
    });

    it("stores lastEnforcementAction", () => {
      state.lastEnforcementAction = "abort_pipeline";
      expect(state.lastEnforcementAction).toBe("abort_pipeline");
    });

    it("clears lastViolation when set to null", () => {
      const violation = {
        domain: "error_rate" as const,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      };
      state.lastViolation = violation;
      state.lastViolation = null;
      expect(state.lastViolation).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles zero-duration window correctly", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 10, total: 1000, timestamp: now });
      const windowData = state.getWindowErrors(0, now);
      expect(windowData.errors).toBe(0);
    });

    it("handles very large burn rate window", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 1,
        total: 10000,
        timestamp: now - 86400000,
      });
      state.addErrorSample({
        errors: 1,
        total: 10000,
        timestamp: now,
      });
      const windowData = state.getWindowErrors(86400000, now);
      expect(windowData.errors).toBeGreaterThanOrEqual(1);
    });

    it("handles saturation value of exactly 0", () => {
      const now = Date.now();
      state.addSaturationSample({ value: 0, timestamp: now });
      const maxSaturation = state.getWindowSaturation(60000, now);
      expect(maxSaturation).toBe(0);
    });

    it("handles saturation value of exactly 1", () => {
      const now = Date.now();
      state.addSaturationSample({ value: 1.0, timestamp: now });
      const maxSaturation = state.getWindowSaturation(60000, now);
      expect(maxSaturation).toBe(1.0);
    });
  });
});
