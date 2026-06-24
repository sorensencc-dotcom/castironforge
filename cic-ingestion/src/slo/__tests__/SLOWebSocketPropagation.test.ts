import { SLOController } from "../SLOController";
import { SLOState } from "../SLOState";
import { SLOPrometheusExporter } from "../SLOPrometheusExporter";
import { SLOWebSocketBridge } from "../SLOWebSocketBridge";
import { SLODomain, EnforcementAction, SLOThresholds, BurnRateWindow } from "../SLOTypes";

describe("SLO WebSocket Event Propagation", () => {
  let state: SLOState;
  let controller: SLOController;
  let exporter: SLOPrometheusExporter;
  let mockPublisher: { send: jest.Mock };
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
    mockPublisher = { send: jest.fn() };
    bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
  });

  describe("violation event propagation", () => {
    it("publishes violation event with correct domain", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 20, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishViolation(violation!);

      expect(mockPublisher.send).toHaveBeenCalledWith(
        "slo.violation",
        expect.objectContaining({
          domain: SLODomain.ErrorRate,
          severity: expect.any(Number),
          message: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });

    it("propagates all SLO domains as violations", () => {
      const now = Date.now();

      state.addLatencySample({
        p50: 80,
        p90: 180,
        p99: 700,
        timestamp: now,
      });
      const latencyViolation = controller.evaluateLatency();
      bridge.publishViolation(latencyViolation!);

      state.addErrorSample({ errors: 25, total: 1000, timestamp: now });
      const errorViolation = controller.evaluateErrorRate(now);
      bridge.publishViolation(errorViolation!);

      state.addSaturationSample({ value: 1.5, timestamp: now });
      const saturationViolation = controller.evaluateSaturation(now);
      bridge.publishViolation(saturationViolation!);

      expect(mockPublisher.send).toHaveBeenCalledTimes(3);

      const calls = mockPublisher.send.mock.calls;
      expect(calls[0][1].domain).toBe(SLODomain.Latency);
      expect(calls[1][1].domain).toBe(SLODomain.ErrorRate);
      expect(calls[2][1].domain).toBe(SLODomain.Saturation);
    });

    it("includes violation severity in event", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 30, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishViolation(violation!);

      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload.severity).toBe(3);
    });

    it("includes violation message in event", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 20, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishViolation(violation!);

      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload.message).toContain("0.02");
    });

    it("includes violation timestamp in event", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 20, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishViolation(violation!);

      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload.timestamp).toBe(now);
    });
  });

  describe("enforcement event propagation", () => {
    it("publishes enforcement event when action is triggered", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 150, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      controller.enforce(EnforcementAction.AbortPipeline, violation!);
      bridge.publishEnforcement(EnforcementAction.AbortPipeline, violation!);

      expect(mockPublisher.send).toHaveBeenCalledWith(
        "slo.enforcement",
        expect.objectContaining({
          action: EnforcementAction.AbortPipeline,
          domain: SLODomain.ErrorRate,
        })
      );
    });

    it("propagates all enforcement actions", () => {
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 3,
        message: "test",
        timestamp: Date.now(),
      };

      const actions = [
        EnforcementAction.AbortPipeline,
        EnforcementAction.RollbackAdapter,
        EnforcementAction.DegradeMode,
        EnforcementAction.QuarantineAgent,
        EnforcementAction.ResetState,
      ];

      for (const action of actions) {
        mockPublisher.send.mockClear();
        bridge.publishEnforcement(action, violation);
        expect(mockPublisher.send).toHaveBeenCalledWith(
          "slo.enforcement",
          expect.objectContaining({ action })
        );
      }
    });

    it("includes violation context in enforcement event", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 150, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishEnforcement(EnforcementAction.RollbackAdapter, violation!);

      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload).toMatchObject({
        domain: violation!.domain,
        severity: violation!.severity,
        message: violation!.message,
        timestamp: violation!.timestamp,
      });
    });
  });

  describe("event ordering and sequencing", () => {
    it("publishes violation before enforcement action", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 150, total: 1000, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishViolation(violation!);
      bridge.publishEnforcement(EnforcementAction.AbortPipeline, violation!);

      expect(mockPublisher.send).toHaveBeenCalledTimes(2);
      expect(mockPublisher.send.mock.calls[0][0]).toBe("slo.violation");
      expect(mockPublisher.send.mock.calls[1][0]).toBe("slo.enforcement");
    });

    it("publishes events in correct sequence during escalation", () => {
      const now = Date.now();

      state.addSaturationSample({ value: 0.85, timestamp: now });
      let violation = controller.evaluateSaturation(now);
      bridge.publishViolation(violation!);

      state.addSaturationSample({ value: 1.3, timestamp: now + 1000 });
      violation = controller.evaluateSaturation(now + 1000);
      bridge.publishViolation(violation!);
      bridge.publishEnforcement(EnforcementAction.DegradeMode, violation!);

      state.addSaturationSample({ value: 1.8, timestamp: now + 2000 });
      violation = controller.evaluateSaturation(now + 2000);
      bridge.publishViolation(violation!);
      bridge.publishEnforcement(EnforcementAction.QuarantineAgent, violation!);

      expect(mockPublisher.send).toHaveBeenCalledTimes(5);
      const events = mockPublisher.send.mock.calls.map(c => c[0]);
      expect(events).toEqual([
        "slo.violation",
        "slo.violation",
        "slo.enforcement",
        "slo.violation",
        "slo.enforcement",
      ]);
    });
  });

  describe("event payload integrity", () => {
    it("does not mutate violation when publishing", () => {
      const now = Date.now();
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test error",
        timestamp: now,
      };
      const original = JSON.parse(JSON.stringify(violation));

      bridge.publishViolation(violation);

      expect(violation).toEqual(original);
    });

    it("preserves exact metric values in events", () => {
      const now = Date.now();
      state.addErrorSample({ errors: 17, total: 1234, timestamp: now });
      const violation = controller.evaluateErrorRate(now);

      bridge.publishViolation(violation!);

      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload.message).toMatch(/0\.01/);
    });

    it("maintains timestamp precision in events", () => {
      const now = Date.now();
      state.addSaturationSample({ value: 0.9, timestamp: now });
      const violation = controller.evaluateSaturation(now);

      bridge.publishViolation(violation!);

      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload.timestamp).toBe(now);
    });
  });

  describe("high-frequency event propagation", () => {
    it("handles rapid-fire violations without loss", () => {
      const now = Date.now();
      const violations = [];

      for (let i = 0; i < 100; i++) {
        state.addLatencySample({
          p50: 50 + i,
          p90: 150 + i,
          p99: 400 + i,
          timestamp: now + i,
        });
        const violation = controller.evaluateLatency();
        if (violation) {
          violations.push(violation);
          bridge.publishViolation(violation);
        }
      }

      expect(mockPublisher.send).toHaveBeenCalledTimes(violations.length);
    });

    it("maintains correct call count with mixed violation types", () => {
      const now = Date.now();
      let callCount = 0;

      for (let i = 0; i < 10; i++) {
        state.addLatencySample({
          p50: 50,
          p90: 150,
          p99: 600,
          timestamp: now + i * 1000,
        });
        const latencyViolation = controller.evaluateLatency();
        if (latencyViolation) {
          bridge.publishViolation(latencyViolation);
          callCount++;
        }

        state.addErrorSample({
          errors: 20,
          total: 1000,
          timestamp: now + i * 1000,
        });
        const errorViolation = controller.evaluateErrorRate(now + i * 1000);
        if (errorViolation) {
          bridge.publishViolation(errorViolation);
          callCount++;
        }
      }

      expect(mockPublisher.send).toHaveBeenCalledTimes(callCount);
    });
  });

  describe("end-to-end: SLO violation -> enforcement -> WS propagation", () => {
    it("complete flow: detect -> enforce -> publish metrics -> publish events", () => {
      const now = Date.now();

      state.addErrorSample({
        errors: 40,
        total: 1000,
        timestamp: now,
      });

      const violation = controller.evaluateErrorRate(now);
      expect(violation).not.toBeNull();
      expect(violation!.severity).toBe(3);

      const shouldEnforce = controller.shouldEnforce(violation, now);
      expect(shouldEnforce).toBe(true);

      controller.enforce(EnforcementAction.AbortPipeline, violation!);
      expect(state.lastEnforcementAction).toBe(EnforcementAction.AbortPipeline);

      const metrics = exporter.collect();
      expect(metrics).toContain("slo_last_violation_timestamp");
      expect(metrics).toContain("slo_last_enforcement_action");
      expect(metrics).toContain(EnforcementAction.AbortPipeline);

      bridge.publishViolation(violation!);
      expect(mockPublisher.send).toHaveBeenCalledWith(
        "slo.violation",
        expect.objectContaining({
          domain: SLODomain.ErrorRate,
          severity: 3,
        })
      );

      bridge.publishEnforcement(EnforcementAction.AbortPipeline, violation!);
      expect(mockPublisher.send).toHaveBeenCalledWith(
        "slo.enforcement",
        expect.objectContaining({
          action: EnforcementAction.AbortPipeline,
          severity: 3,
        })
      );

      expect(mockPublisher.send).toHaveBeenCalledTimes(2);
    });

    it("multi-violation scenario: latency + error-rate + saturation + enforcement sequence", () => {
      const now = Date.now();

      const violations = [];

      state.addLatencySample({
        p50: 150,
        p90: 250,
        p99: 700,
        timestamp: now,
      });
      const latencyViolation = controller.evaluateLatency();
      violations.push({ type: "latency", v: latencyViolation });
      if (latencyViolation) bridge.publishViolation(latencyViolation);

      state.addErrorSample({
        errors: 30,
        total: 1000,
        timestamp: now,
      });
      const errorViolation = controller.evaluateErrorRate(now);
      violations.push({ type: "error", v: errorViolation });
      if (errorViolation) bridge.publishViolation(errorViolation);

      state.addSaturationSample({ value: 1.8, timestamp: now });
      const saturationViolation = controller.evaluateSaturation(now);
      violations.push({ type: "saturation", v: saturationViolation });
      if (saturationViolation) bridge.publishViolation(saturationViolation);

      const publishedViolations = violations.filter(v => v.v !== null).length;
      expect(mockPublisher.send).toHaveBeenCalledTimes(publishedViolations);

      for (const { v } of violations) {
        if (v && controller.shouldEnforce(v, now)) {
          bridge.publishEnforcement(EnforcementAction.QuarantineAgent, v);
        }
      }

      const totalCalls = mockPublisher.send.mock.calls.length;
      expect(totalCalls).toBeGreaterThanOrEqual(publishedViolations);
    });
  });

  describe("event publisher robustness", () => {
    it("handles publisher that logs errors", () => {
      const mockLogger = { send: jest.fn(() => {}) };
      const robustBridge = new SLOWebSocketBridge({ publisher: mockLogger });

      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      };

      expect(() => {
        robustBridge.publishViolation(violation);
        robustBridge.publishEnforcement(EnforcementAction.DegradeMode, violation);
      }).not.toThrow();

      expect(mockLogger.send).toHaveBeenCalledTimes(2);
    });

    it("publishes consistently regardless of prior state", () => {
      const violation = {
        domain: SLODomain.Saturation,
        severity: 1,
        message: "minor",
        timestamp: 12345,
      };

      bridge.publishViolation(violation);
      const firstCall = mockPublisher.send.mock.calls[0];

      mockPublisher.send.mockClear();

      bridge.publishViolation(violation);
      const secondCall = mockPublisher.send.mock.calls[0];

      expect(firstCall).toEqual(secondCall);
    });

    it("maintains event integrity across multiple publishes", () => {
      const violations = [
        { domain: SLODomain.Latency, severity: 1, message: "msg1", timestamp: 100 },
        { domain: SLODomain.ErrorRate, severity: 2, message: "msg2", timestamp: 200 },
        { domain: SLODomain.Saturation, severity: 3, message: "msg3", timestamp: 300 },
      ];

      for (const v of violations) {
        bridge.publishViolation(v);
      }

      for (let i = 0; i < violations.length; i++) {
        const payload = mockPublisher.send.mock.calls[i][1];
        expect(payload.domain).toBe(violations[i].domain);
        expect(payload.severity).toBe(violations[i].severity);
        expect(payload.message).toBe(violations[i].message);
        expect(payload.timestamp).toBe(violations[i].timestamp);
      }
    });
  });
});
