import { SLOController } from "../SLOController";
import { SLOState } from "../SLOState";
import {
  SLODomain,
  SLOThresholds,
  BurnRateWindow,
  EnforcementAction,
} from "../SLOTypes";

describe("SLOController", () => {
  let state: SLOState;
  let controller: SLOController;

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
    { durationMs: 1800000, allowedErrors: 2000 },
  ];

  beforeEach(() => {
    state = new SLOState({
      thresholds: defaultThresholds,
      burnRateWindows: defaultWindows,
    });
    controller = new SLOController(state);
  });

  describe("evaluateLatency", () => {
    it("returns null when no samples exist", () => {
      const violation = controller.evaluateLatency();
      expect(violation).toBeNull();
    });

    it("returns null when p50 is within threshold", () => {
      state.addLatencySample({
        p50: 50,
        p90: 150,
        p99: 400,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateLatency();
      expect(violation).toBeNull();
    });

    it("detects p50 violation with severity 1", () => {
      state.addLatencySample({
        p50: 150,
        p90: 150,
        p99: 400,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateLatency();
      expect(violation).not.toBeNull();
      expect(violation!.domain).toBe(SLODomain.Latency);
      expect(violation!.severity).toBe(1);
    });

    it("detects p90 violation with severity 2", () => {
      state.addLatencySample({
        p50: 50,
        p90: 250,
        p99: 400,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateLatency();
      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe(2);
    });

    it("detects p99 violation with severity 3", () => {
      state.addLatencySample({
        p50: 50,
        p90: 150,
        p99: 600,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateLatency();
      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe(3);
    });

    it("prioritizes higher percentile violations", () => {
      state.addLatencySample({
        p50: 150,
        p90: 250,
        p99: 600,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateLatency();
      expect(violation!.severity).toBe(3);
    });
  });

  describe("evaluateErrorRate", () => {
    it("returns null when no errors", () => {
      state.addErrorSample({
        errors: 0,
        total: 100,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateErrorRate();
      expect(violation).toBeNull();
    });

    it("returns null when error rate is below threshold", () => {
      state.addErrorSample({
        errors: 1,
        total: 1000,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateErrorRate();
      expect(violation).toBeNull();
    });

    it("detects error rate violation", () => {
      state.addErrorSample({
        errors: 20,
        total: 1000,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateErrorRate();
      expect(violation).not.toBeNull();
      expect(violation!.domain).toBe(SLODomain.ErrorRate);
    });

    it("assigns severity based on error rate multiple", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 15,
        total: 1000,
        timestamp: now,
      });
      const violation1 = controller.evaluateErrorRate(now);
      expect(violation1!.severity).toBe(1);

      state = new SLOState({
        thresholds: defaultThresholds,
        burnRateWindows: defaultWindows,
      });
      controller = new SLOController(state);

      state.addErrorSample({
        errors: 25,
        total: 1000,
        timestamp: now,
      });
      const violation2 = controller.evaluateErrorRate(now);
      expect(violation2!.severity).toBe(2);

      state = new SLOState({
        thresholds: defaultThresholds,
        burnRateWindows: defaultWindows,
      });
      controller = new SLOController(state);

      state.addErrorSample({
        errors: 30,
        total: 1000,
        timestamp: now,
      });
      const violation3 = controller.evaluateErrorRate(now);
      expect(violation3!.severity).toBe(3);
    });

    it("returns null when total is 0", () => {
      state.addErrorSample({
        errors: 0,
        total: 0,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateErrorRate();
      expect(violation).toBeNull();
    });
  });

  describe("evaluateSaturation", () => {
    it("returns null when saturation is below threshold", () => {
      state.addSaturationSample({
        value: 0.5,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateSaturation();
      expect(violation).toBeNull();
    });

    it("detects saturation violation", () => {
      state.addSaturationSample({
        value: 0.9,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateSaturation();
      expect(violation).not.toBeNull();
      expect(violation!.domain).toBe(SLODomain.Saturation);
    });

    it("assigns severity based on saturation multiple", () => {
      const now = Date.now();
      state.addSaturationSample({
        value: 0.85,
        timestamp: now,
      });
      const violation1 = controller.evaluateSaturation(now);
      expect(violation1!.severity).toBe(1);

      state = new SLOState({
        thresholds: defaultThresholds,
        burnRateWindows: defaultWindows,
      });
      controller = new SLOController(state);

      state.addSaturationSample({
        value: 1.2,
        timestamp: now,
      });
      const violation2 = controller.evaluateSaturation(now);
      expect(violation2!.severity).toBe(2);

      state = new SLOState({
        thresholds: defaultThresholds,
        burnRateWindows: defaultWindows,
      });
      controller = new SLOController(state);

      state.addSaturationSample({
        value: 1.7,
        timestamp: now,
      });
      const violation3 = controller.evaluateSaturation(now);
      expect(violation3!.severity).toBe(3);
    });
  });

  describe("computeBurnRate", () => {
    it("returns 0 when no errors", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 0,
        total: 100,
        timestamp: now,
      });
      const burnRate = controller.computeBurnRate(now);
      expect(burnRate).toBe(0);
    });

    it("computes burn rate for single window", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 50,
        total: 500,
        timestamp: now,
      });
      const burnRate = controller.computeBurnRate(now);
      expect(burnRate).toBeGreaterThan(0);
    });

    it("returns maximum burn rate across windows", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 100,
        total: 1000,
        timestamp: now,
      });
      const burnRate = controller.computeBurnRate(now);
      const expected = 100 / 100;
      expect(burnRate).toBeCloseTo(expected);
    });

    it("returns 0 when allowedErrors is 0", () => {
      const state2 = new SLOState({
        thresholds: defaultThresholds,
        burnRateWindows: [{ durationMs: 60000, allowedErrors: 0 }],
      });
      const controller2 = new SLOController(state2);
      const now = Date.now();
      state2.addErrorSample({
        errors: 100,
        total: 1000,
        timestamp: now,
      });
      const burnRate = controller2.computeBurnRate(now);
      expect(burnRate).toBe(0);
    });
  });

  describe("shouldEnforce", () => {
    it("returns false when no violation", () => {
      const result = controller.shouldEnforce(null);
      expect(result).toBe(false);
    });

    it("returns false when burn rate is below 1.0", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 10,
        total: 1000,
        timestamp: now,
      });
      const violation = controller.evaluateErrorRate(now);
      const result = controller.shouldEnforce(violation, now);
      expect(result).toBe(false);
    });

    it("returns false when severity is below 2", () => {
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: Date.now(),
      };
      const result = controller.shouldEnforce(violation);
      expect(result).toBe(false);
    });

    it("returns true when burn rate >= 1.0 and severity >= 2", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 150,
        total: 1000,
        timestamp: now,
      });
      const violation = controller.evaluateErrorRate(now);
      const result = controller.shouldEnforce(violation, now);
      expect(result).toBe(true);
    });
  });

  describe("enforce", () => {
    it("updates lastEnforcementAction", () => {
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 3,
        message: "test",
        timestamp: Date.now(),
      };
      controller.enforce(EnforcementAction.AbortPipeline, violation);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.AbortPipeline);
    });

    it("updates lastViolation", () => {
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 3,
        message: "test",
        timestamp: Date.now(),
      };
      controller.enforce(EnforcementAction.RollbackAdapter, violation);
      expect(state.lastViolation).toBe(violation);
    });
  });

  describe("violation message formatting", () => {
    it("includes metric values in latency violation message", () => {
      state.addLatencySample({
        p50: 150,
        p90: 150,
        p99: 400,
        timestamp: Date.now(),
      });
      const violation = controller.evaluateLatency();
      expect(violation!.message).toContain("150");
      expect(violation!.message).toContain("100");
    });

    it("includes rate in error rate violation message", () => {
      const now = Date.now();
      state.addErrorSample({
        errors: 20,
        total: 1000,
        timestamp: now,
      });
      const violation = controller.evaluateErrorRate(now);
      expect(violation!.message).toContain("0.02");
    });
  });
});
