import { SLOController } from "../SLOController";
import { SLOState } from "../SLOState";
import { SLOPrometheusExporter } from "../SLOPrometheusExporter";
import { SLOWebSocketBridge } from "../SLOWebSocketBridge";
import { SLODomain, EnforcementAction, SLOThresholds, BurnRateWindow } from "../SLOTypes";

describe("SLO Integration Tests", () => {
  let state: SLOState;
  let controller: SLOController;
  let exporter: SLOPrometheusExporter;
  let wsPublisher: { send: jest.Mock };
  let bridge: SLOWebSocketBridge;

  const thresholds: SLOThresholds = {
    latencyP50: 100,
    latencyP90: 200,
    latencyP99: 500,
    errorRate: 0.01,
    saturation: 0.8,
  };

  const windows: BurnRateWindow[] = [
    { durationMs: 60000, allowedErrors: 100 },
    { durationMs: 300000, allowedErrors: 400 },
    { durationMs: 1800000, allowedErrors: 2000 },
  ];

  beforeEach(() => {
    state = new SLOState({ thresholds, burnRateWindows: windows });
    controller = new SLOController(state);
    exporter = new SLOPrometheusExporter(state);
    wsPublisher = { send: jest.fn() };
    bridge = new SLOWebSocketBridge({ publisher: wsPublisher });
  });

  describe("end-to-end: error rate violation -> enforcement -> metrics", () => {
    it("detects violation, triggers enforcement, exports metrics, publishes event", () => {
      const now = Date.now();

      // Add enough errors to exceed burn rate threshold (1.0)
      // Window 1 allows 100 errors, so we need at least 100 errors for burn >= 1.0
      state.addErrorSample({
        errors: 150,
        total: 5000,
        timestamp: now,
      });

      const violation = controller.evaluateErrorRate(now);
      expect(violation).not.toBeNull();
      expect(violation!.severity).toBeGreaterThanOrEqual(2);

      const shouldEnforce = controller.shouldEnforce(violation, now);
      expect(shouldEnforce).toBe(true);

      controller.enforce(EnforcementAction.AbortPipeline, violation!);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.AbortPipeline);

      const metrics = exporter.collect();
      expect(metrics).toContain("slo_last_violation_timestamp");
      expect(metrics).toContain("slo_last_enforcement_action");
      expect(metrics).toContain(EnforcementAction.AbortPipeline);

      bridge.publishViolation(violation!);
      expect(wsPublisher.send).toHaveBeenCalledWith("slo.violation", expect.any(Object));

      bridge.publishEnforcement(EnforcementAction.AbortPipeline, violation!);
      expect(wsPublisher.send).toHaveBeenCalledWith("slo.enforcement", expect.any(Object));
    });
  });

  describe("end-to-end: latency violation flow", () => {
    it("tracks latency samples, evaluates, enforces, exports", () => {
      const now = Date.now();

      state.addLatencySample({
        p50: 80,
        p90: 180,
        p99: 700,
        timestamp: now,
      });

      const violation = controller.evaluateLatency();
      expect(violation).not.toBeNull();
      expect(violation!.domain).toBe(SLODomain.Latency);

      controller.enforce(EnforcementAction.DegradeMode, violation!);

      const metrics = exporter.collect();
      expect(metrics).toContain("slo_last_violation_domain");
      expect(metrics).toContain(SLODomain.Latency);

      bridge.publishEnforcement(EnforcementAction.DegradeMode, violation!);
      expect(wsPublisher.send).toHaveBeenCalledWith("slo.enforcement", {
        action: EnforcementAction.DegradeMode,
        domain: SLODomain.Latency,
        severity: violation!.severity,
        message: expect.any(String),
        timestamp: now,
      });
    });
  });

  describe("end-to-end: saturation escalation", () => {
    it("tracks saturation, computes burn rate, triggers escalating enforcement", () => {
      const now = Date.now();

      state.addSaturationSample({ value: 0.85, timestamp: now });
      let violation = controller.evaluateSaturation(now);
      expect(violation!.severity).toBe(1);

      state.addSaturationSample({ value: 1.3, timestamp: now + 1000 });
      violation = controller.evaluateSaturation(now + 1000);
      expect(violation!.severity).toBe(2);

      state.addSaturationSample({ value: 2.0, timestamp: now + 2000 });
      violation = controller.evaluateSaturation(now + 2000);
      expect(violation!.severity).toBe(3);

      controller.enforce(EnforcementAction.QuarantineAgent, violation!);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.QuarantineAgent);
    });
  });

  describe("end-to-end: multi-window burn-rate computation", () => {
    it("accumulates errors across windows and computes max burn rate", () => {
      const now = Date.now();

      state.addErrorSample({
        errors: 50,
        total: 500,
        timestamp: now - 90000,
      });
      state.addErrorSample({
        errors: 100,
        total: 1000,
        timestamp: now,
      });

      const burnRate = controller.computeBurnRate(now);
      expect(burnRate).toBeGreaterThan(0);

      const shouldEnforce = controller.shouldEnforce({
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: now,
      }, now);
      expect(shouldEnforce).toBe(true);
    });
  });

  describe("end-to-end: state persistence across evaluations", () => {
    it("maintains state across multiple evaluation cycles", () => {
      const now = Date.now();

      state.addLatencySample({
        p50: 50,
        p90: 150,
        p99: 400,
        timestamp: now,
      });
      const latencyViolation = controller.evaluateLatency();
      expect(latencyViolation).toBeNull();

      state.addErrorSample({
        errors: 5,
        total: 1000,
        timestamp: now,
      });
      const errorViolation = controller.evaluateErrorRate(now);
      expect(errorViolation).toBeNull();

      state.addSaturationSample({
        value: 0.5,
        timestamp: now,
      });
      const saturationViolation = controller.evaluateSaturation(now);
      expect(saturationViolation).toBeNull();

      const metrics = exporter.collect();
      expect(metrics).toContain("slo_last_violation_timestamp 0");
    });
  });

  describe("end-to-end: enforcement action sequence", () => {
    it("allows enforcement action sequence: degrade -> quarantine -> abort", () => {
      const now = Date.now();
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 3,
        message: "critical",
        timestamp: now,
      };

      controller.enforce(EnforcementAction.DegradeMode, violation);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.DegradeMode);

      controller.enforce(EnforcementAction.QuarantineAgent, violation);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.QuarantineAgent);

      controller.enforce(EnforcementAction.AbortPipeline, violation);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.AbortPipeline);

      const metrics = exporter.collect();
      expect(metrics).toContain(EnforcementAction.AbortPipeline);
    });
  });

  describe("end-to-end: WebSocket event broadcasting", () => {
    it("broadcasts all violation events correctly", () => {
      const now = Date.now();

      const violations = [
        {
          domain: SLODomain.Latency,
          severity: 2,
          message: "p90 exceeded",
          timestamp: now,
        },
        {
          domain: SLODomain.ErrorRate,
          severity: 3,
          message: "error rate critical",
          timestamp: now + 1000,
        },
        {
          domain: SLODomain.Saturation,
          severity: 1,
          message: "saturation warning",
          timestamp: now + 2000,
        },
      ];

      for (const violation of violations) {
        bridge.publishViolation(violation);
      }

      expect(wsPublisher.send).toHaveBeenCalledTimes(violations.length);

      for (let i = 0; i < violations.length; i++) {
        const call = wsPublisher.send.mock.calls[i];
        expect(call[0]).toBe("slo.violation");
        expect(call[1]).toMatchObject({
          domain: violations[i].domain,
          severity: violations[i].severity,
        });
      }
    });
  });

  describe("end-to-end: Prometheus scrape stability", () => {
    it("produces consistent, parseable metrics after multiple events", () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        state.addLatencySample({
          p50: 50 + i,
          p90: 150 + i,
          p99: 400 + i,
          timestamp: now + i * 1000,
        });
      }

      const violation = controller.evaluateLatency();
      controller.enforce(EnforcementAction.DegradeMode, violation!);

      const metrics1 = exporter.collect();
      const metrics2 = exporter.collect();

      expect(metrics1).toBe(metrics2);
      expect(metrics1).toMatch(/slo_last_violation_timestamp \d+/);
      expect(metrics1).toMatch(/slo_last_violation_severity \d/);
      expect(metrics1).toMatch(/action="degrade_mode"/);
    });
  });

  describe("end-to-end: rolling window pruning", () => {
    it("prunes old samples while maintaining active window data", () => {
      const maxWindow = Math.max(...windows.map(w => w.durationMs));
      const now = Date.now();

      state.addErrorSample({
        errors: 10,
        total: 1000,
        timestamp: now - maxWindow - 10000,
      });

      state.addErrorSample({
        errors: 20,
        total: 2000,
        timestamp: now,
      });

      const windowData = state.getWindowErrors(maxWindow, now);
      expect(windowData.errors).toBe(20);
      expect(windowData.total).toBe(2000);

      const burnRate = controller.computeBurnRate(now);
      expect(burnRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("end-to-end: realtime scenario simulation", () => {
    it("simulates realistic 5-minute SLO violation sequence", () => {
      let now = Date.now();
      const minuteMs = 60000;

      const scenario = [
        { minute: 0, errors: 5, total: 1000 },
        { minute: 1, errors: 8, total: 1000 },
        { minute: 2, errors: 15, total: 1000 },
        { minute: 3, errors: 25, total: 1000 },
        { minute: 4, errors: 30, total: 1000 },
      ];

      for (const { minute, errors, total } of scenario) {
        const timestamp = now + minute * minuteMs;
        state.addErrorSample({ errors, total, timestamp });

        const violation = controller.evaluateErrorRate(timestamp);
        if (violation) {
          bridge.publishViolation(violation);

          if (controller.shouldEnforce(violation, timestamp)) {
            controller.enforce(EnforcementAction.AbortPipeline, violation);
            bridge.publishEnforcement(EnforcementAction.AbortPipeline, violation);
          }
        }
      }

      expect(wsPublisher.send).toHaveBeenCalled();
      const metrics = exporter.collect();
      expect(metrics).toContain("slo_last_enforcement_action");
    });
  });
});
