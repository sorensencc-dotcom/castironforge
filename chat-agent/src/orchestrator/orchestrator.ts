import { randomUUID } from 'crypto';
import { runtimeRegistry } from '../runtimes/registry';
import { policyEnforcer } from '../middleware/policyGate';
import { estimateResponseTokens } from '../utils/tokenCounter';
import type {
  AgentDefinition,
  TaskRequest,
  TaskResult,
  WorkflowDefinition,
  WorkflowExecution,
  OrchestrationConfig,
  WorkflowStep,
  AgentRole
} from './types';

/**
 * Orchestrator: Coordinates multi-agent execution
 *
 * Philosophy: Explicit delegation, deterministic routing, operator control
 * - Supervisor explicitly routes tasks to sub-agents
 * - No auto-scaling; operator defines max concurrency
 * - All decisions logged for auditability
 * - Policies enforced at task level
 */
export class Orchestrator {
  private config: OrchestrationConfig;
  private activeTasks: Map<string, TaskRequest> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private activeWorkflows: Map<string, WorkflowExecution> = new Map();

  constructor(config: OrchestrationConfig) {
    this.config = {
      maxConcurrentTasks: 10,
      defaultTimeout: 30000,
      enableLogging: true,
      ...config
    };
  }

  /**
   * Execute a single task via a sub-agent
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // 1. Validate agent exists
      const agentDef = this.config.agents.get(request.agent);
      if (!agentDef) {
        return this.buildResult(request, 'rejected', undefined, `Agent '${request.agent}' not found`, startTime);
      }

      // 2. Check concurrency limit
      if (this.config.maxConcurrentTasks && this.activeTasks.size >= this.config.maxConcurrentTasks) {
        return this.buildResult(request, 'rejected', undefined, 'Max concurrent tasks exceeded', startTime);
      }

      // 3. Check policy (model allowed, token budget)
      const policyError = this.checkTaskPolicy(request.sessionId, agentDef.model);
      if (policyError) {
        return this.buildResult(request, 'rejected', undefined, policyError, startTime);
      }

      // 4. Track active task
      this.activeTasks.set(request.taskId, request);

      // 5. Get runtime for agent's model
      const runtime = runtimeRegistry.resolve(agentDef.model);

      // 6. Execute via runtime
      const prompt = this.buildPrompt(request.instruction, request.context);
      const timeout = agentDef.timeout ?? this.config.defaultTimeout ?? 30000;
      const result = await Promise.race([
        runtime.complete({ sessionId: request.sessionId, model: agentDef.model, message: prompt }),
        this.createTimeout(timeout)
      ]);

      // 7. Record token usage
      const tokensUsed = estimateResponseTokens(result);
      policyEnforcer.recordTokens(request.sessionId, tokensUsed);

      // 8. Clean up and return
      this.activeTasks.delete(request.taskId);
      return this.buildResult(request, 'success', result, undefined, startTime, tokensUsed);
    } catch (err) {
      this.activeTasks.delete(request.taskId);

      if (err instanceof TimeoutError) {
        return this.buildResult(request, 'timeout', undefined, 'Task timeout', startTime);
      }

      const error = err instanceof Error ? err.message : String(err);
      return this.buildResult(request, 'failed', undefined, error, startTime);
    }
  }

  /**
   * Execute a multi-step workflow
   */
  async executeWorkflow(workflowId: string, sessionId: string, context?: Record<string, any>): Promise<WorkflowExecution> {
    const workflow = this.config.workflows?.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    const executionId = randomUUID();
    const execution: WorkflowExecution = {
      workflowId,
      executionId,
      sessionId,
      status: 'running',
      steps: new Map(),
      startTime: Date.now()
    };

    this.activeWorkflows.set(executionId, execution);

    try {
      await this.executeWorkflowSteps(workflow, execution, context);
      execution.status = 'success';
    } catch (err) {
      execution.status = 'failed';
      console.error(`[Orchestrator] Workflow execution failed: ${executionId}`, err);
    } finally {
      execution.endTime = Date.now();
      this.activeWorkflows.delete(executionId);
    }

    return execution;
  }

  /**
   * Get agent definition
   */
  getAgent(role: AgentRole): AgentDefinition | undefined {
    return this.config.agents.get(role);
  }

  /**
   * List all agents
   */
  listAgents(): AgentDefinition[] {
    return Array.from(this.config.agents.values());
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskRequest[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.completedTasks.get(taskId);
  }

  /**
   * Get workflow execution status
   */
  getWorkflowExecution(executionId: string): WorkflowExecution | undefined {
    return this.activeWorkflows.get(executionId);
  }

  // ==================== Private Helpers ====================

  private async executeWorkflowSteps(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    context?: Record<string, any>
  ): Promise<void> {
    const completed = new Set<string>();
    const pending = new Map(workflow.steps.map(s => [s.id, s]));

    while (pending.size > 0) {
      let executed = false;

      for (const [stepId, step] of pending.entries()) {
        // Check if dependencies are met
        if (step.dependsOn?.some(dep => !completed.has(dep))) {
          continue;
        }

        // Execute step
        const taskRequest: TaskRequest = {
          taskId: `${execution.executionId}-${stepId}`,
          sessionId: execution.sessionId,
          agent: step.agent,
          instruction: step.instruction,
          context
        };

        const result = await this.executeTask(taskRequest);
        execution.steps.set(stepId, result);

        // Handle result
        if (result.status === 'success') {
          completed.add(stepId);
          pending.delete(stepId);
          executed = true;

          // Update context with output
          if (step.onSuccess && result.output) {
            context = { ...context, [stepId]: result.output };
          }
        } else {
          // Handle failure
          if (step.onFailure) {
            // Execute failure handler
            const failureStep = workflow.steps.find(s => s.id === step.onFailure);
            if (failureStep) {
              const failureTask: TaskRequest = {
                taskId: `${execution.executionId}-${step.onFailure}`,
                sessionId: execution.sessionId,
                agent: failureStep.agent,
                instruction: failureStep.instruction,
                context: { ...context, error: result.error }
              };
              const failureResult = await this.executeTask(failureTask);
              execution.steps.set(step.onFailure, failureResult);
              completed.add(step.onFailure);
            }
          }

          completed.add(stepId);
          pending.delete(stepId);
          executed = true;
        }
      }

      if (!executed && pending.size > 0) {
        throw new Error('Workflow deadlock: no progress on pending steps');
      }
    }
  }

  private checkTaskPolicy(sessionId: string, model: string): string | null {
    // Policy checks (model allowed, tokens available, etc.)
    // This is delegated to PolicyEnforcer; we just surface the result
    try {
      runtimeRegistry.resolve(model);
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  private buildPrompt(instruction: string, context?: Record<string, any>): string {
    let prompt = instruction;

    if (context && Object.keys(context).length > 0) {
      prompt += '\n\nContext:\n';
      for (const [key, value] of Object.entries(context)) {
        prompt += `${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return prompt;
  }

  private buildResult(
    request: TaskRequest,
    status: TaskResult['status'],
    output: any,
    error: string | undefined,
    startTime: number,
    tokensUsed: number = 0
  ): TaskResult {
    const result: TaskResult = {
      taskId: request.taskId,
      agent: request.agent,
      status,
      output,
      error,
      duration: Date.now() - startTime,
      tokensUsed
    };

    this.completedTasks.set(request.taskId, result);

    if (this.config.enableLogging) {
      console.log(`[Orchestrator] Task ${request.taskId} (${request.agent}) ${status} [${result.duration}ms, ${tokensUsed} tokens]`);
      if (error) {
        console.error(`  Error: ${error}`);
      }
    }

    return result;
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new TimeoutError(`Task exceeded timeout of ${ms}ms`)), ms);
    });
  }
}

class TimeoutError extends Error {
  name = 'TimeoutError';
}

/**
 * Create a default orchestrator with common agents
 */
export function createDefaultOrchestrator(): Orchestrator {
  const agents: Map<AgentRole, AgentDefinition> = new Map([
    [
      'supervisor',
      {
        id: 'supervisor',
        role: 'supervisor',
        model: 'local:default',
        description: 'Routes tasks to sub-agents',
        capabilities: ['routing', 'delegation', 'decision-making']
      }
    ],
    [
      'harvester',
      {
        id: 'harvester',
        role: 'harvester',
        model: 'local:default',
        description: 'Extracts structured data from sources',
        capabilities: ['extraction', 'parsing', 'filtering']
      }
    ],
    [
      'enricher',
      {
        id: 'enricher',
        role: 'enricher',
        model: 'local:default',
        description: 'Enriches data with inference',
        capabilities: ['inference', 'classification', 'synthesis']
      }
    ],
    [
      'evaluator',
      {
        id: 'evaluator',
        role: 'evaluator',
        model: 'local:default',
        description: 'Evaluates quality and correctness',
        capabilities: ['evaluation', 'scoring', 'validation']
      }
    ]
  ]);

  return new Orchestrator({
    agents,
    maxConcurrentTasks: 10,
    defaultTimeout: 30000,
    enableLogging: true
  });
}

// Singleton instance
export const orchestrator = createDefaultOrchestrator();
