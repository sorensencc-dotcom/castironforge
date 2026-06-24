import { SLOWebSocketBridge } from "../SLOWebSocketBridge";
import { SLODomain, EnforcementAction } from "../SLOTypes";

describe("SLOWebSocketBridge", () => {
  let bridge: SLOWebSocketBridge;

  describe("constructor", () => {
    it("initializes with no publisher or subscriber", () => {
      bridge = new SLOWebSocketBridge();
      expect(() => bridge.publishViolation({
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      })).not.toThrow();
    });

    it("initializes with provided publisher and subscriber", () => {
      const mockPublisher = { send: jest.fn() };
      const mockSubscriber = { onHealth: jest.fn() };
      bridge = new SLOWebSocketBridge({
        publisher: mockPublisher,
        healthSubscriber: mockSubscriber,
      });
      expect(bridge).toBeDefined();
    });
  });

  describe("publishViolation", () => {
    it("does not throw when no publisher", () => {
      bridge = new SLOWebSocketBridge();
      expect(() => bridge.publishViolation({
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      })).not.toThrow();
    });

    it("publishes violation to publisher", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "error rate too high",
        timestamp: 12345,
      };
      bridge.publishViolation(violation);
      expect(mockPublisher.send).toHaveBeenCalledWith("slo.violation", {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "error rate too high",
        timestamp: 12345,
      });
    });

    it("publishes latency violations", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.Latency,
        severity: 3,
        message: "p99 latency exceeded",
        timestamp: 54321,
      };
      bridge.publishViolation(violation);
      expect(mockPublisher.send).toHaveBeenCalledWith("slo.violation", expect.objectContaining({
        domain: SLODomain.Latency,
        severity: 3,
      }));
    });

    it("publishes saturation violations", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.Saturation,
        severity: 2,
        message: "saturation too high",
        timestamp: 99999,
      };
      bridge.publishViolation(violation);
      expect(mockPublisher.send).toHaveBeenCalledWith("slo.violation", expect.objectContaining({
        domain: SLODomain.Saturation,
      }));
    });

    it("publishes all violation fields", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "minor violation",
        timestamp: 11111,
      };
      bridge.publishViolation(violation);
      const call = mockPublisher.send.mock.calls[0];
      const payload = call[1];
      expect(payload).toHaveProperty("domain");
      expect(payload).toHaveProperty("severity");
      expect(payload).toHaveProperty("message");
      expect(payload).toHaveProperty("timestamp");
    });
  });

  describe("publishEnforcement", () => {
    it("does not throw when no publisher", () => {
      bridge = new SLOWebSocketBridge();
      expect(() => bridge.publishEnforcement(
        EnforcementAction.AbortPipeline,
        {
          domain: SLODomain.ErrorRate,
          severity: 2,
          message: "test",
          timestamp: Date.now(),
        }
      )).not.toThrow();
    });

    it("publishes enforcement action to publisher", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 3,
        message: "critical error rate",
        timestamp: 22222,
      };
      bridge.publishEnforcement(EnforcementAction.AbortPipeline, violation);
      expect(mockPublisher.send).toHaveBeenCalledWith("slo.enforcement", expect.objectContaining({
        action: EnforcementAction.AbortPipeline,
        domain: SLODomain.ErrorRate,
        severity: 3,
      }));
    });

    it("publishes different enforcement actions", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.Latency,
        severity: 2,
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
        expect(mockPublisher.send).toHaveBeenCalledWith("slo.enforcement", expect.objectContaining({
          action,
        }));
      }
    });

    it("includes violation data in enforcement event", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.Saturation,
        severity: 1,
        message: "saturation warning",
        timestamp: 33333,
      };
      bridge.publishEnforcement(EnforcementAction.DegradeMode, violation);
      const call = mockPublisher.send.mock.calls[0];
      const payload = call[1];
      expect(payload).toMatchObject({
        domain: SLODomain.Saturation,
        severity: 1,
        message: "saturation warning",
        timestamp: 33333,
      });
    });

    it("uses correct event name for enforcement", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "test",
        timestamp: Date.now(),
      };
      bridge.publishEnforcement(EnforcementAction.QuarantineAgent, violation);
      expect(mockPublisher.send.mock.calls[0][0]).toBe("slo.enforcement");
    });
  });

  describe("subscribeToHealth", () => {
    it("does not throw when no subscriber", () => {
      bridge = new SLOWebSocketBridge();
      expect(() => bridge.subscribeToHealth()).not.toThrow();
    });

    it("subscribes to health events", () => {
      const mockSubscriber = { onHealth: jest.fn() };
      bridge = new SLOWebSocketBridge({ healthSubscriber: mockSubscriber });
      bridge.subscribeToHealth();
      expect(mockSubscriber.onHealth).toHaveBeenCalled();
    });

    it("provides callback to subscriber", () => {
      const mockSubscriber = { onHealth: jest.fn() };
      bridge = new SLOWebSocketBridge({ healthSubscriber: mockSubscriber });
      bridge.subscribeToHealth();
      const callback = mockSubscriber.onHealth.mock.calls[0][0];
      expect(typeof callback).toBe("function");
    });

    it("callback is invoked when health event occurs", () => {
      let capturedCallback: ((payload: unknown) => void) | null = null;
      const mockSubscriber = {
        onHealth: (cb: (payload: unknown) => void) => {
          capturedCallback = cb;
        },
      };
      bridge = new SLOWebSocketBridge({ healthSubscriber: mockSubscriber });
      bridge.subscribeToHealth();
      expect(capturedCallback).not.toBeNull();
      expect(() => capturedCallback!({ status: "healthy" })).not.toThrow();
    });
  });

  describe("event names", () => {
    it("uses slo.violation event name", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      bridge.publishViolation({
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: Date.now(),
      });
      expect(mockPublisher.send.mock.calls[0][0]).toBe("slo.violation");
    });

    it("uses slo.enforcement event name", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      bridge.publishEnforcement(EnforcementAction.AbortPipeline, {
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: Date.now(),
      });
      expect(mockPublisher.send.mock.calls[0][0]).toBe("slo.enforcement");
    });
  });

  describe("multiple publishers and subscribers", () => {
    it("can be reconfigured with different publisher", () => {
      const mockPublisher1 = { send: jest.fn() };
      const mockPublisher2 = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher1 });
      bridge.publishViolation({
        domain: SLODomain.ErrorRate,
        severity: 1,
        message: "test",
        timestamp: Date.now(),
      });
      expect(mockPublisher1.send).toHaveBeenCalled();
      expect(mockPublisher2.send).not.toHaveBeenCalled();
    });
  });

  describe("payload integrity", () => {
    it("does not modify violation when publishing", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.ErrorRate,
        severity: 2,
        message: "unchanged message",
        timestamp: 55555,
      };
      const original = { ...violation };
      bridge.publishViolation(violation);
      expect(violation).toEqual(original);
    });

    it("preserves all fields in enforcement event", () => {
      const mockPublisher = { send: jest.fn() };
      bridge = new SLOWebSocketBridge({ publisher: mockPublisher });
      const violation = {
        domain: SLODomain.Latency,
        severity: 3,
        message: "detailed message",
        timestamp: 77777,
      };
      bridge.publishEnforcement(EnforcementAction.ResetState, violation);
      const payload = mockPublisher.send.mock.calls[0][1];
      expect(payload.message).toBe("detailed message");
      expect(payload.timestamp).toBe(77777);
    });
  });
});
