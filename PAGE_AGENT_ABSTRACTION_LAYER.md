# PAGE-AGENT ABSTRACTION LAYER

**Version:** 1.0.0  
**Owner:** RewriteLabs Frontend Architecture  
**Updated:** 2026-06-20

---

## 0. Purpose

Decouple the "Send to Client" UX workflow from the specific automation engine (Page-Agent today, custom engine tomorrow). This allows you to:

- Swap out Page-Agent without rewriting chat UI
- Test multiple engines in parallel
- Maintain consistent API across all outreach interactions
- Make engine selection a runtime decision

---

## 1. Interface Definition

```typescript
// src/services/automation/types.ts

export interface OutreachAutomationEngine {
  /**
   * Initialize the engine (load runtime, resources, etc.)
   */
  init(): Promise<void>

  /**
   * Check if the engine is available in the current environment
   */
  isAvailable(): boolean

  /**
   * Execute a workflow script
   * @param script - Natural language or domain-specific task description
   * @returns - Workflow result (success, error, logs)
   */
  runWorkflow(script: string): Promise<WorkflowResult>

  /**
   * Get engine health status
   */
  getHealth(): Promise<EngineHealth>

  /**
   * Cleanup / teardown
   */
  cleanup(): Promise<void>
}

export interface WorkflowResult {
  success: boolean
  output?: string
  error?: string
  logs: string[]
  duration_ms: number
}

export interface EngineHealth {
  status: 'healthy' | 'degraded' | 'unavailable'
  error?: string
  latency_ms?: number
}
```

---

## 2. Page-Agent Implementation

```typescript
// src/services/automation/engines/pageAgentEngine.ts

import { OutreachAutomationEngine, WorkflowResult, EngineHealth } from '../types'

export class PageAgentEngine implements OutreachAutomationEngine {
  private pageAgent: any = null
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return

    try {
      // Load page-agent from CDN or local module
      if (!window.pageAgent) {
        await this.loadPageAgentRuntime()
      }

      this.pageAgent = window.pageAgent

      // Initialize with your LLM credentials
      await this.pageAgent.init({
        model: process.env.VITE_PAGE_AGENT_MODEL || 'claude-3-5-sonnet',
        apiKey: process.env.VITE_ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
        language: 'en-US'
      })

      this.initialized = true
      console.log('[PageAgentEngine] Initialized successfully')
    } catch (err) {
      console.error('[PageAgentEngine] Initialization failed:', err)
      throw err
    }
  }

  isAvailable(): boolean {
    return !!this.pageAgent && this.initialized
  }

  async runWorkflow(script: string): Promise<WorkflowResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Page-Agent not initialized',
        logs: [],
        duration_ms: 0
      }
    }

    const startTime = performance.now()

    try {
      const result = await this.pageAgent.run(script)
      const duration_ms = performance.now() - startTime

      return {
        success: true,
        output: result,
        logs: result.logs || [],
        duration_ms
      }
    } catch (err) {
      const duration_ms = performance.now() - startTime

      return {
        success: false,
        error: String(err),
        logs: err.logs || [],
        duration_ms
      }
    }
  }

  async getHealth(): Promise<EngineHealth> {
    if (!this.isAvailable()) {
      return { status: 'unavailable', error: 'Not initialized' }
    }

    try {
      const startTime = performance.now()
      await this.pageAgent.ping()
      const latency_ms = performance.now() - startTime

      return { status: 'healthy', latency_ms }
    } catch (err) {
      return { status: 'degraded', error: String(err) }
    }
  }

  async cleanup(): Promise<void> {
    if (this.pageAgent?.cleanup) {
      await this.pageAgent.cleanup()
    }
    this.initialized = false
  }

  private async loadPageAgentRuntime(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/gh/alibaba/page-agent/dist/page-agent.js'
      script.crossOrigin = 'anonymous'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Page-Agent runtime'))
      document.head.appendChild(script)
    })
  }
}
```

---

## 3. Future Engine Example (Swappable)

```typescript
// src/services/automation/engines/customDomAutomationEngine.ts

import { OutreachAutomationEngine, WorkflowResult, EngineHealth } from '../types'

/**
 * Example: A custom DOM automation engine (replaces Page-Agent without touching UI)
 * Could use Playwright via WASM, custom automation logic, or a different LLM
 */
export class CustomDomAutomationEngine implements OutreachAutomationEngine {
  private worker: Worker | null = null

  async init(): Promise<void> {
    // Load WASM automation runtime or web worker
    this.worker = new Worker(
      new URL('../workers/automationWorker.ts', import.meta.url),
      { type: 'module' }
    )
    console.log('[CustomDomAutomationEngine] Initialized')
  }

  isAvailable(): boolean {
    return !!this.worker
  }

  async runWorkflow(script: string): Promise<WorkflowResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'Custom automation engine not initialized',
        logs: [],
        duration_ms: 0
      }
    }

    return new Promise((resolve) => {
      const startTime = performance.now()

      const handler = (event: MessageEvent) => {
        this.worker?.removeEventListener('message', handler)
        const duration_ms = performance.now() - startTime
        resolve({ ...event.data, duration_ms })
      }

      this.worker.addEventListener('message', handler)
      this.worker.postMessage({ type: 'run_workflow', script })
    })
  }

  async getHealth(): Promise<EngineHealth> {
    if (!this.isAvailable()) {
      return { status: 'unavailable' }
    }
    return { status: 'healthy' }
  }

  async cleanup(): Promise<void> {
    this.worker?.terminate()
    this.worker = null
  }
}
```

---

## 4. Engine Selector (Factory Pattern)

```typescript
// src/services/automation/engineSelector.ts

import { OutreachAutomationEngine } from './types'
import { PageAgentEngine } from './engines/pageAgentEngine'
import { CustomDomAutomationEngine } from './engines/customDomAutomationEngine'

type EngineType = 'page-agent' | 'custom-dom' | 'auto'

let currentEngine: OutreachAutomationEngine | null = null

/**
 * Create an automation engine instance
 */
export async function createEngine(type: EngineType = 'auto'): Promise<OutreachAutomationEngine> {
  let engine: OutreachAutomationEngine

  if (type === 'page-agent') {
    engine = new PageAgentEngine()
  } else if (type === 'custom-dom') {
    engine = new CustomDomAutomationEngine()
  } else {
    // Auto-detect: try Page-Agent first, fall back to custom
    engine = new PageAgentEngine()
    await engine.init().catch(async () => {
      console.warn('[engineSelector] Page-Agent init failed, trying custom engine')
      engine = new CustomDomAutomationEngine()
      await engine.init()
    })
    return engine
  }

  await engine.init()
  return engine
}

/**
 * Get or create the current automation engine
 */
export async function getAutomationEngine(): Promise<OutreachAutomationEngine> {
  if (!currentEngine) {
    currentEngine = await createEngine('auto')
  }
  return currentEngine
}

/**
 * Swap the engine at runtime (useful for testing or fallback)
 */
export async function switchEngine(type: EngineType): Promise<OutreachAutomationEngine> {
  if (currentEngine) {
    await currentEngine.cleanup()
  }
  currentEngine = await createEngine(type)
  return currentEngine
}

/**
 * Shutdown current engine
 */
export async function shutdownEngine(): Promise<void> {
  if (currentEngine) {
    await currentEngine.cleanup()
    currentEngine = null
  }
}
```

---

## 5. Usage in "Send to Client" CTA

```typescript
// src/features/outreach/sendToClientCTA.ts

import { getAutomationEngine } from '@/services/automation/engineSelector'

interface SendToClientRequest {
  lead: {
    name: string
    email: string
  }
  message: string
}

export async function sendToClient(request: SendToClientRequest): Promise<void> {
  const engine = await getAutomationEngine()

  // Check engine health before proceeding
  const health = await engine.getHealth()
  if (health.status === 'unavailable') {
    throw new Error('Automation engine unavailable; please send manually')
  }

  // Construct workflow script (natural language or domain-specific)
  const script = `
    Fill the message textarea with: "${escapeScriptString(request.message)}"
    Then click the "Send to Client" button
    Wait for confirmation
  `

  try {
    const result = await engine.runWorkflow(script)

    if (!result.success) {
      throw new Error(result.error || 'Workflow failed')
    }

    console.log(`[sendToClient] Success for ${request.lead.name}`)
    console.log(`Workflow logs:`, result.logs)

    // Emit telemetry
    emitEvent('outreach.send.success', {
      engine: 'page-agent', // or whatever engine was used
      lead_name: request.lead.name,
      duration_ms: result.duration_ms
    })

    return result
  } catch (err) {
    console.error(`[sendToClient] Failed for ${request.lead.name}:`, err)

    emitEvent('outreach.send.error', {
      engine: 'page-agent',
      lead_name: request.lead.name,
      error: String(err)
    })

    throw err
  }
}

function escapeScriptString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function emitEvent(eventName: string, data: any): void {
  // Hook into your telemetry/analytics system
  console.log(`[telemetry] ${eventName}:`, data)
}
```

---

## 6. Usage in Chat UI Component

```typescript
// src/components/ChatMessage/SendToClientButton.tsx

import React, { useState } from 'react'
import { sendToClient } from '@/features/outreach/sendToClientCTA'

interface SendToClientButtonProps {
  leadName: string
  leadEmail: string
  messageContent: string
  onSuccess: () => void
  onError: (error: Error) => void
}

export function SendToClientButton({
  leadName,
  leadEmail,
  messageContent,
  onSuccess,
  onError
}: SendToClientButtonProps) {
  const [isRunning, setIsRunning] = useState(false)

  async function handleClick() {
    setIsRunning(true)

    try {
      await sendToClient({
        lead: { name: leadName, email: leadEmail },
        message: messageContent
      })
      onSuccess()
    } catch (err) {
      onError(err as Error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={isRunning}>
      {isRunning ? 'Sending...' : 'Send to Client'}
    </button>
  )
}
```

---

## 7. Benefits of This Abstraction

| Benefit | Description |
|---------|------------|
| **Engine Swappable** | Replace Page-Agent with custom engine without touching UI code |
| **Runtime Selection** | Choose engine at initialization time based on environment |
| **Testing** | Mock `OutreachAutomationEngine` interface for unit tests |
| **Fallback Support** | Automatic fallback to alternative engine if primary fails |
| **Monitoring** | Consistent health checks and metrics across all engines |
| **Type Safety** | Full TypeScript support; engines must implement interface |
| **Extensible** | Add new engines (Playwright, custom WASM, headless, etc.) as methods change |

---

## 8. Configuration (Environment Variables)

```bash
# .env.local

# Primary engine: 'page-agent' or 'custom-dom'
VITE_AUTOMATION_ENGINE=page-agent

# Page-Agent configuration
VITE_PAGE_AGENT_MODEL=claude-3-5-sonnet
VITE_ANTHROPIC_API_KEY=sk-ant-...

# Feature flags
VITE_ENABLE_ENGINE_SWAP=true
VITE_ENABLE_TELEMETRY=true
```

---

## 9. Integration with Backend

The abstraction layer is **frontend-only**. Backend remains independent:

- Backend: `/api/outreach/send` (handles batch, scheduling, delivery)
- Frontend: `sendToClient()` (uses abstraction layer to run Page-Agent)
- Planning Engine: Calls `/api/outreach/send` directly (no frontend involvement)

This keeps concerns separated and allows each system to evolve independently.

---

## 10. Migration Path (Future)

If you replace Page-Agent with a custom engine:

1. **Implement `CustomDomAutomationEngine`** (new file)
2. **Update engine selector** (one line: change `createEngine('custom-dom')`)
3. **Chat UI code remains unchanged**
4. **Zero downtime if you support fallback**

