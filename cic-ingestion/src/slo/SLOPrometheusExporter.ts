import { SLOState } from "./SLOState";
import { SLOViolation } from "./SLOTypes";

export class SLOPrometheusExporter {
  private state: SLOState;

  constructor(state: SLOState) {
    this.state = state;
  }

  registerMetrics(): void {
    // Metrics are registered with the metrics subsystem at higher level.
  }

  collect(): string {
    const lines: string[] = [];

    const last = this.state.lastViolation;
    const action = this.state.lastEnforcementAction;

    if (last) {
      lines.push(`slo_last_violation_timestamp ${last.timestamp}`);
      lines.push(`slo_last_violation_severity ${last.severity}`);
      lines.push(`slo_last_violation_domain{domain="${last.domain}"} 1`);
    } else {
      lines.push(`slo_last_violation_timestamp 0`);
      lines.push(`slo_last_violation_severity 0`);
    }

    if (action) {
      lines.push(`slo_last_enforcement_action{action="${action}"} 1`);
    } else {
      lines.push(`slo_last_enforcement_action{action="none"} 0`);
    }

    return lines.join("\n") + "\n";
  }
}
