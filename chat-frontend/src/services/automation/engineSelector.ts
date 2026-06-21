import { OutreachAutomationEngine } from './types.js'
import { PageAgentEngine } from './engines/pageAgentEngine.js'

export type EngineType = 'page-agent' | 'backend-batch'

export interface EngineConfig {
  type: EngineType
  apiBaseUrl?: string
  authToken?: string
}

let engineInstance: OutreachAutomationEngine | null = null
let currentConfig: EngineConfig | null = null

export async function getAutomationEngine(config: EngineConfig): Promise<OutreachAutomationEngine> {
  if (engineInstance && currentConfig?.type === config.type) {
    return engineInstance
  }

  if (engineInstance) {
    await engineInstance.cleanup()
  }

  if (config.type === 'page-agent') {
    engineInstance = new PageAgentEngine(config)
  } else {
    throw new Error(`Unsupported engine type: ${config.type}`)
  }

  currentConfig = config
  if (!engineInstance) {
    throw new Error('Failed to create engine instance')
  }
  await engineInstance.init()
  return engineInstance
}

export async function cleanupEngine(): Promise<void> {
  if (engineInstance) {
    await engineInstance.cleanup()
    engineInstance = null
    currentConfig = null
  }
}
