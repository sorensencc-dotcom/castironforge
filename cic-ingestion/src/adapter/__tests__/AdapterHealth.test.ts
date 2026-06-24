import { AdapterHealthMonitor } from "../AdapterHealth";

describe("AdapterHealthMonitor", () => {
  let monitor: AdapterHealthMonitor;

  beforeEach(() => {
    monitor = new AdapterHealthMonitor(30000);
  });

  describe("adapter registration", () => {
    it("registers adapter with healthy status", () => {
      monitor.registerAdapter("adapter1");
      const status = monitor.getStatus("adapter1");

      expect(status).not.toBeNull();
      expect(status!.adapterId).toBe("adapter1");
      expect(status!.isHealthy).toBe(true);
      expect(status!.failureCount).toBe(0);
      expect(status!.successCount).toBe(0);
    });

    it("initializes multiple adapters", () => {
      monitor.registerAdapter("adapter1");
      monitor.registerAdapter("adapter2");
      monitor.registerAdapter("adapter3");

      const statuses = monitor.getAllStatus();
      expect(statuses).toHaveLength(3);
      expect(statuses.map(s => s.adapterId)).toContain("adapter1");
      expect(statuses.map(s => s.adapterId)).toContain("adapter2");
      expect(statuses.map(s => s.adapterId)).toContain("adapter3");
    });
  });

  describe("health tracking", () => {
    beforeEach(() => {
      monitor.registerAdapter("adapter1");
    });

    it("increments success count on recordSuccess", () => {
      monitor.recordSuccess("adapter1");
      monitor.recordSuccess("adapter1");

      const status = monitor.getStatus("adapter1");
      expect(status!.successCount).toBe(2);
    });

    it("increments failure count on recordFailure", () => {
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");

      const status = monitor.getStatus("adapter1");
      expect(status!.failureCount).toBe(2);
    });

    it("marks adapter unhealthy after threshold failures", () => {
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");

      const status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(false);
    });

    it("keeps adapter healthy before threshold", () => {
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");

      const status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(true);
    });

    it("recovers health on success after failures", () => {
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");

      let status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(false);

      monitor.recordSuccess("adapter1");
      status = monitor.getStatus("adapter1");
      expect(status!.failureCount).toBe(2);
    });

    it("fully recovers to healthy when failures clear", () => {
      for (let i = 0; i < 3; i++) {
        monitor.recordFailure("adapter1");
      }

      let status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(false);

      for (let i = 0; i < 3; i++) {
        monitor.recordSuccess("adapter1");
      }

      status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(true);
      expect(status!.failureCount).toBe(0);
    });
  });

  describe("isHealthy checks", () => {
    it("returns true for healthy adapters", () => {
      monitor.registerAdapter("adapter1");
      expect(monitor.isHealthy("adapter1")).toBe(true);
    });

    it("returns false for unhealthy adapters", () => {
      monitor.registerAdapter("adapter1");
      for (let i = 0; i < 3; i++) {
        monitor.recordFailure("adapter1");
      }
      expect(monitor.isHealthy("adapter1")).toBe(false);
    });

    it("returns false for unregistered adapters", () => {
      expect(monitor.isHealthy("nonexistent")).toBe(false);
    });
  });

  describe("healthy adapters list", () => {
    it("returns all healthy adapters", () => {
      monitor.registerAdapter("adapter1");
      monitor.registerAdapter("adapter2");
      monitor.registerAdapter("adapter3");

      for (let i = 0; i < 3; i++) {
        monitor.recordFailure("adapter2");
      }

      const healthy = monitor.getHealthyAdapters();
      expect(healthy).toContain("adapter1");
      expect(healthy).toContain("adapter3");
      expect(healthy).not.toContain("adapter2");
    });

    it("returns empty list when all unhealthy", () => {
      monitor.registerAdapter("adapter1");
      monitor.registerAdapter("adapter2");

      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 3; i++) {
          monitor.recordFailure(`adapter${j + 1}`);
        }
      }

      const healthy = monitor.getHealthyAdapters();
      expect(healthy).toHaveLength(0);
    });
  });

  describe("reset operations", () => {
    it("resets individual adapter status", () => {
      monitor.registerAdapter("adapter1");

      for (let i = 0; i < 3; i++) {
        monitor.recordFailure("adapter1");
      }

      let status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(false);

      monitor.reset("adapter1");
      status = monitor.getStatus("adapter1");

      expect(status!.isHealthy).toBe(true);
      expect(status!.failureCount).toBe(0);
      expect(status!.successCount).toBe(0);
    });

    it("resets all adapters", () => {
      monitor.registerAdapter("adapter1");
      monitor.registerAdapter("adapter2");

      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");
      monitor.recordFailure("adapter1");
      monitor.recordSuccess("adapter2");

      monitor.resetAll();

      const all = monitor.getAllStatus();
      expect(all.every(s => s.isHealthy)).toBe(true);
      expect(all.every(s => s.failureCount === 0)).toBe(true);
      expect(all.every(s => s.successCount === 0)).toBe(true);
    });
  });

  describe("timestamp tracking", () => {
    it("updates lastCheck on success", () => {
      monitor.registerAdapter("adapter1");
      const before = Date.now();
      monitor.recordSuccess("adapter1");
      const after = Date.now();

      const status = monitor.getStatus("adapter1");
      expect(status!.lastCheck).toBeGreaterThanOrEqual(before);
      expect(status!.lastCheck).toBeLessThanOrEqual(after);
    });

    it("updates lastCheck on failure", () => {
      monitor.registerAdapter("adapter1");
      const before = Date.now();
      monitor.recordFailure("adapter1");
      const after = Date.now();

      const status = monitor.getStatus("adapter1");
      expect(status!.lastCheck).toBeGreaterThanOrEqual(before);
      expect(status!.lastCheck).toBeLessThanOrEqual(after);
    });
  });

  describe("alternating success and failure", () => {
    it("alternates between healthy and unhealthy", () => {
      monitor.registerAdapter("adapter1");

      let status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(true);

      for (let i = 0; i < 3; i++) {
        monitor.recordFailure("adapter1");
      }
      status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(false);

      for (let i = 0; i < 3; i++) {
        monitor.recordSuccess("adapter1");
      }
      status = monitor.getStatus("adapter1");
      expect(status!.isHealthy).toBe(true);
    });
  });

  describe("concurrent operations", () => {
    it("handles concurrent status checks", () => {
      monitor.registerAdapter("adapter1");
      monitor.recordSuccess("adapter1");

      const statuses = [
        monitor.getStatus("adapter1"),
        monitor.getStatus("adapter1"),
        monitor.getStatus("adapter1"),
      ];

      expect(statuses.every(s => s !== null && s.successCount === 1)).toBe(true);
    });

    it("handles concurrent record operations", () => {
      monitor.registerAdapter("adapter1");

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          monitor.recordSuccess("adapter1");
        } else {
          monitor.recordFailure("adapter1");
        }
      }

      const status = monitor.getStatus("adapter1");
      expect(status!.successCount + status!.failureCount).toBe(10);
    });
  });

  describe("negative failure count protection", () => {
    it("does not allow negative failure count", () => {
      monitor.registerAdapter("adapter1");
      monitor.recordSuccess("adapter1");

      const status = monitor.getStatus("adapter1");
      expect(status!.failureCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("multiple adapters independence", () => {
    it("failure of one adapter does not affect others", () => {
      monitor.registerAdapter("adapter1");
      monitor.registerAdapter("adapter2");

      for (let i = 0; i < 3; i++) {
        monitor.recordFailure("adapter1");
      }

      const status1 = monitor.getStatus("adapter1");
      const status2 = monitor.getStatus("adapter2");

      expect(status1!.isHealthy).toBe(false);
      expect(status2!.isHealthy).toBe(true);
    });
  });
});
