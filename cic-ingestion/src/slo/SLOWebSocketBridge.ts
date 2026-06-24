import { SLOViolation, EnforcementAction } from "./SLOTypes";

export interface WebSocketPublisher {
  send(event: string, payload: unknown): void;
}

export interface HealthSubscriber {
  onHealth(callback: (payload: unknown) => void): void;
}

export class SLOWebSocketBridge {
  private publisher: WebSocketPublisher | null = null;
  private healthSubscriber: HealthSubscriber | null = null;

  constructor(opts?: {
    publisher?: WebSocketPublisher;
    healthSubscriber?: HealthSubscriber;
  }) {
    if (opts?.publisher) this.publisher = opts.publisher;
    if (opts?.healthSubscriber) this.healthSubscriber = opts.healthSubscriber;
  }

  publishViolation(violation: SLOViolation): void {
    if (!this.publisher) return;
    this.publisher.send("slo.violation", {
      domain: violation.domain,
      severity: violation.severity,
      message: violation.message,
      timestamp: violation.timestamp,
    });
  }

  publishEnforcement(action: EnforcementAction, violation: SLOViolation): void {
    if (!this.publisher) return;
    this.publisher.send("slo.enforcement", {
      action,
      domain: violation.domain,
      severity: violation.severity,
      message: violation.message,
      timestamp: violation.timestamp,
    });
  }

  subscribeToHealth(): void {
    if (!this.healthSubscriber) return;
    this.healthSubscriber.onHealth((_payload) => {
      // Adapter health events can be forwarded into SLOState via higher-level wiring.
    });
  }
}
