import { SLOPrometheusExporter } from "../SLOPrometheusExporter";
import { SLOState } from "../SLOState";
import { SLODomain, SLOThresholds, BurnRateWindow } from "../SLOTypes";

describe("SLOPrometheusExporter", () => {
  let state: SLOState;
  let exporter: SLOPrometheusExporter;

  const defaultThresholds: SLOThresholds = {
    latencyP50: 100,
    latencyP90: 200,
    latencyP99: 500,
    errorRate: 0.01,
    saturation: 0.8,
  };

  const defaultWindows: BurnRateWindow[] = [
    { durationMs: 60000, allowedErrors: 100 },
  ];

  beforeEach(() => {
    state = new SLOState({
      thresholds: defaultThresholds,
      burnRateWindows: defaultWindows,
    });
    exporter = new SLOPrometheusExporter(state);
  });

  describe("collect", () => {
    it("returns string output", () => {
      const output = exporter.collect();
      expect(typeof output).toBe("string");
    });

    it("ends with newline", () => {
      const output = exporter.collect();
      expect(output).toMatch(/\n$/);
    });

    it("includes default metrics when no violation", () => {
      const output = exporter.collect();
      expect(output).toContain("slo_last_violation_timestamp 0");
      expect(output).toContain("slo_last_violation_severity 0");
    });

    it("includes enforcement action metric", () => {
      const output = exporter.collect();
      expect(output).toContain("slo_last_enforcement_action");
    });
  });

  describe("violation metrics", () => {
    it("exports violation timestamp", () => {
      const now = Date.now();
      state.lastViolation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: now,
      };
      const output = exporter.collect();
      expect(output).toContain(`slo_last_violation_timestamp ${now}`);
    });

    it("exports violation severity", () => {
      state.lastViolation = {
        domain: SLODomain.ErrorRate,
        severity: 3,
        message: "test",
        timestamp: Date.now(),
      };
      const output = exporter.collect();
      expect(output).toContain("slo_last_violation_severity 3");
    });

    it("exports violation domain label", () => {
      state.lastViolation = {
        domain: SLODomain.Latency,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      };
      const output = exporter.collect();
      expect(output).toContain(`domain="${SLODomain.Latency}"`);
    });

    it("exports different domains correctly", () => {
      state.lastViolation = {
        domain: SLODomain.Saturation,
        severity: 1,
        message: "test",
        timestamp: Date.now(),
      };
      const output = exporter.collect();
      expect(output).toContain(`domain="${SLODomain.Saturation}"`);
    });

    it("resets violation timestamp to 0 when cleared", () => {
      state.lastViolation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      };
      state.lastViolation = null;
      const output = exporter.collect();
      expect(output).toContain("slo_last_violation_timestamp 0");
    });
  });

  describe("enforcement action metrics", () => {
    it("exports enforcement action when set", () => {
      state.lastEnforcementAction = "abort_pipeline";
      const output = exporter.collect();
      expect(output).toContain('action="abort_pipeline"');
    });

    it("exports different enforcement actions", () => {
      state.lastEnforcementAction = "rollback_adapter";
      const output = exporter.collect();
      expect(output).toContain('action="rollback_adapter"');
    });

    it("defaults to none when no action", () => {
      const output = exporter.collect();
      expect(output).toContain('action="none"');
    });

    it("resets action metric when action cleared", () => {
      state.lastEnforcementAction = "abort_pipeline";
      state.lastEnforcementAction = null;
      const output = exporter.collect();
      expect(output).toContain('action="none"');
      expect(output).not.toContain('action="abort_pipeline"');
    });
  });

  describe("metric format compliance", () => {
    it("produces valid Prometheus format (no spaces around =)", () => {
      const output = exporter.collect();
      expect(output).not.toMatch(/\s+=\s+/);
    });

    it("produces lines separated by newlines", () => {
      const output = exporter.collect();
      const lines = output.split("\n").filter(l => l.length > 0);
      expect(lines.length).toBeGreaterThan(0);
    });

    it("uses correct metric names", () => {
      const output = exporter.collect();
      expect(output).toMatch(/slo_last_violation_timestamp/);
      expect(output).toMatch(/slo_last_violation_severity/);
      expect(output).toMatch(/slo_last_violation_domain/);
      expect(output).toMatch(/slo_last_enforcement_action/);
    });

    it("escapes label values with quotes", () => {
      state.lastViolation = {
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: Date.now(),
      };
      const output = exporter.collect();
      expect(output).toMatch(/domain="error_rate"/);
    });
  });

  describe("registerMetrics", () => {
    it("does not throw", () => {
      expect(() => exporter.registerMetrics()).not.toThrow();
    });
  });

  describe("metric value ranges", () => {
    it("handles very large violation timestamps", () => {
      const largeTimestamp = 9007199254740991;
      state.lastViolation = {
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: largeTimestamp,
      };
      const output = exporter.collect();
      expect(output).toContain(`slo_last_violation_timestamp ${largeTimestamp}`);
    });

    it("handles all severity levels", () => {
      for (let severity = 0; severity <= 3; severity++) {
        state.lastViolation = {
          domain: SLODomain.ErrorRate,
          severity,
          message: "test",
          timestamp: Date.now(),
        };
        const output = exporter.collect();
        expect(output).toContain(`slo_last_violation_severity ${severity}`);
      }
    });
  });

  describe("multiple collections", () => {
    it("produces consistent output for same state", () => {
      state.lastViolation = {
        domain: SLODomain.Latency,
        severity: 2,
        message: "test",
        timestamp: 12345,
      };
      const output1 = exporter.collect();
      const output2 = exporter.collect();
      expect(output1).toBe(output2);
    });

    it("reflects state changes", () => {
      const output1 = exporter.collect();
      expect(output1).toContain("slo_last_violation_timestamp 0");

      state.lastViolation = {
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: 99999,
      };
      const output2 = exporter.collect();
      expect(output2).toContain("slo_last_violation_timestamp 99999");
    });
  });
});
