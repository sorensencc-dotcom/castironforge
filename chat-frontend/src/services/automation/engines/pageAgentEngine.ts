import { OutreachAutomationEngine, AutomationScript, WorkflowResult, EngineHealth, StepResult } from '../types.js'
import { EngineConfig } from '../engineSelector.js'

export class PageAgentEngine implements OutreachAutomationEngine {
  private config: EngineConfig
  private initialized = false
  private startTime = 0

  constructor(config: EngineConfig) {
    this.config = config
  }

  async init(): Promise<void> {
    if (this.initialized) return
    console.log('[PageAgentEngine] Initializing')
    this.initialized = true
  }

  async runWorkflow(script: AutomationScript): Promise<WorkflowResult> {
    const startTime = Date.now()
    const stepResults: StepResult[] = []

    try {
      for (let i = 0; i < script.steps.length; i++) {
        const step = script.steps[i]
        const stepStart = Date.now()

        try {
          console.log(`[PageAgentEngine] Step ${i + 1}: ${step.action}`)

          if (step.action === 'fill-form') {
            await this.fillForm(step.target || '', step.value || '')
          } else if (step.action === 'click') {
            await this.clickElement(step.target || '')
          } else if (step.action === 'submit-form') {
            await this.submitForm(step.target || '')
          } else {
            throw new Error(`Unknown action: ${step.action}`)
          }

          stepResults.push({
            step: i + 1,
            action: step.action,
            success: true,
            output: { duration: Date.now() - stepStart },
          })
        } catch (error) {
          stepResults.push({
            step: i + 1,
            action: step.action,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })

          if (!script.retryCount || script.retryCount === 0) {
            throw error
          }
        }
      }

      return {
        success: true,
        steps: stepResults,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        steps: stepResults,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized
  }

  async getHealth(): Promise<EngineHealth> {
    return {
      status: this.initialized ? 'healthy' : 'unavailable',
      version: '1.0.0',
      message: this.initialized ? 'Page-Agent engine is ready' : 'Page-Agent engine not initialized',
    }
  }

  async cleanup(): Promise<void> {
    console.log('[PageAgentEngine] Cleaning up')
    this.initialized = false
  }

  private async fillForm(selector: string, value: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLInputElement | null
    if (!element) {
      throw new Error(`Element not found: ${selector}`)
    }
    element.value = value
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    await this.delay(100)
  }

  private async clickElement(selector: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLElement | null
    if (!element) {
      throw new Error(`Element not found: ${selector}`)
    }
    element.click()
    await this.delay(200)
  }

  private async submitForm(selector: string): Promise<void> {
    const form = document.querySelector(selector) as HTMLFormElement | null
    if (!form) {
      throw new Error(`Form not found: ${selector}`)
    }
    form.submit()
    await this.delay(500)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
