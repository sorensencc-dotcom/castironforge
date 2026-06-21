import { DecisionEngine } from './DecisionEngine';
import { Reindexer } from './Reindexer';
import { Reembedder } from './Reembedder';
import { IngestionOrchestrator } from './IngestionOrchestrator';
import { AutonomousConfig, WorkflowTask, WorkflowContext } from './types';

export class WorkflowManager {
  private decisionEngine: DecisionEngine;
  private reindexer: Reindexer;
  private reembedder: Reembedder;
  private ingestionOrchestrator: IngestionOrchestrator;
  private isRunning: boolean = false;
  private maxConcurrent: number;

  constructor(
    config: AutonomousConfig,
    reindexer: Reindexer,
    reembedder: Reembedder,
    ingestionOrchestrator: IngestionOrchestrator
  ) {
    this.decisionEngine = new DecisionEngine(config);
    this.reindexer = reindexer;
    this.reembedder = reembedder;
    this.ingestionOrchestrator = ingestionOrchestrator;
    this.maxConcurrent = config.maxConcurrentWorkflows;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[WorkflowManager] Started');

    // Main workflow loop
    while (this.isRunning) {
      await this.processWorkflows();
      await this.sleep(1000);
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('[WorkflowManager] Stopped');
  }

  private async processWorkflows(): Promise<void> {
    const runningCount = this.decisionEngine.getRunningTasks().length;
    const canRun = this.maxConcurrent - runningCount;

    if (canRun <= 0) return;

    for (let i = 0; i < canRun; i++) {
      const task = this.decisionEngine.getNextTask();
      if (!task) break;

      this.decisionEngine.markTaskRunning(task.id);

      try {
        await this.executeWorkflow(task);
        this.decisionEngine.markTaskCompleted(task.id);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.decisionEngine.markTaskFailed(task.id, errorMsg);
        console.error(`[WorkflowManager] Task failed: ${task.id}`, error);
      }
    }
  }

  private async executeWorkflow(task: WorkflowTask): Promise<void> {
    const context: WorkflowContext = {
      taskId: task.id,
      action: task.action,
      documentId: task.documentId,
      targetPhase: task.targetPhase,
      metadata: {}
    };

    console.log(`[WorkflowManager] Executing ${task.action} for ${task.documentId}`);

    switch (task.action) {
      case 'REINDEX':
        await this.reindexer.reindex(context);
        break;

      case 'REEMBED':
        if (task.documentId) {
          await this.reembedder.reembed(context);
        }
        break;

      case 'FIX_METADATA':
        // FIX_METADATA is similar to REINDEX
        await this.reindexer.reindex(context);
        break;

      case 'EXPAND_CORPUS':
        await this.ingestionOrchestrator.executeExpansionWorkflow(context);
        break;

      default:
        throw new Error(`Unknown workflow action: ${task.action}`);
    }
  }

  async submitRecommendations(recommendations: any[]): Promise<number> {
    const tasks = await this.decisionEngine.processRecommendations(recommendations);
    console.log(`[WorkflowManager] Submitted ${tasks.length} workflow tasks`);
    return tasks.length;
  }

  getStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    totalThroughput: number;
  } {
    const stats = this.decisionEngine.getStats();
    return {
      ...stats,
      totalThroughput: stats.completed + stats.failed
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
