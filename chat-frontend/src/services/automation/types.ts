export interface OutreachAutomationEngine {
  init(): Promise<void>
  runWorkflow(script: AutomationScript): Promise<WorkflowResult>
  isAvailable(): Promise<boolean>
  getHealth(): Promise<EngineHealth>
  cleanup(): Promise<void>
}

export interface AutomationScript {
  name: string
  steps: AutomationStep[]
  timeout?: number
  retryCount?: number
}

export interface AutomationStep {
  action: string
  target?: string
  value?: string
  description?: string
}

export interface WorkflowResult {
  success: boolean
  steps: StepResult[]
  output?: Record<string, unknown>
  error?: string
  duration: number
}

export interface StepResult {
  step: number
  action: string
  success: boolean
  error?: string
  output?: unknown
}

export interface EngineHealth {
  status: 'healthy' | 'degraded' | 'unavailable'
  version: string
  message?: string
}
