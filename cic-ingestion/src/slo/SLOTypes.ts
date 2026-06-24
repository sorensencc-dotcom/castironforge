export enum SLODomain {
  Latency = "latency",
  ErrorRate = "error_rate",
  Saturation = "saturation",
}

export enum EnforcementAction {
  AbortPipeline = "abort_pipeline",
  RollbackAdapter = "rollback_adapter",
  DegradeMode = "degrade_mode",
  QuarantineAgent = "quarantine_agent",
  ResetState = "reset_state",
}

export interface SLOThresholds {
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  errorRate: number;
  saturation: number;
}

export interface BurnRateWindow {
  durationMs: number;
  allowedErrors: number;
}

export interface SLOViolation {
  domain: SLODomain;
  severity: number;
  message: string;
  timestamp: number;
}

export interface LatencySample {
  p50: number;
  p90: number;
  p99: number;
  timestamp: number;
}

export interface ErrorSample {
  errors: number;
  total: number;
  timestamp: number;
}

export interface SaturationSample {
  value: number;
  timestamp: number;
}
