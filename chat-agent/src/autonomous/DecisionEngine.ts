import { CorpusRecommendation } from '../corpus/introspection/RecommendationsEngine';
import { WorkflowTask, AutonomousConfig, WorkflowAction } from './types';

export class DecisionEngine {
  private taskQueue: WorkflowTask[] = [];
  private completedTasks: Set<string> = new Set();
  private failedTasks: Map<string, number> = new Map();

  constructor(private config: AutonomousConfig) {}

  async processRecommendations(recommendations: CorpusRecommendation[]): Promise<WorkflowTask[]> {
    const tasks: WorkflowTask[] = [];

    for (const rec of recommendations) {
      // Check if this action is enabled for current autonomy level
      if (!this.isActionAllowed(rec.action)) {
        continue;
      }

      // Check if task already exists or failed too many times
      if (this.shouldSkipTask(rec)) {
        continue;
      }

      const task = this.createWorkflowTask(rec);
      tasks.push(task);
      this.taskQueue.push(task);
    }

    // Sort by priority
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return tasks;
  }

  private isActionAllowed(action: WorkflowAction): boolean {
    const { autonomyLevel, enableAutoReindex, enableAutoReembed, enableAutoMetadataFix, enableAutoExpand } = this.config;

    if (autonomyLevel === 'recommended') {
      return false; // Only surface, don't execute
    }

    if (autonomyLevel === 'trusted') {
      // Execute low-risk actions
      switch (action) {
        case 'REINDEX':
          return enableAutoReindex;
        case 'REEMBED':
          return enableAutoReembed;
        case 'FIX_METADATA':
          return enableAutoMetadataFix;
        case 'EXPAND_CORPUS':
          return false; // Requires approval
        default:
          return false;
      }
    }

    if (autonomyLevel === 'autonomous') {
      // Execute all actions
      return (
        (action === 'REINDEX' && enableAutoReindex) ||
        (action === 'REEMBED' && enableAutoReembed) ||
        (action === 'FIX_METADATA' && enableAutoMetadataFix) ||
        (action === 'EXPAND_CORPUS' && enableAutoExpand)
      );
    }

    return false;
  }

  private shouldSkipTask(rec: CorpusRecommendation): boolean {
    const taskKey = `${rec.action}-${rec.id}`;

    // Already completed
    if (this.completedTasks.has(taskKey)) {
      return true;
    }

    // Failed too many times
    const failCount = this.failedTasks.get(taskKey) || 0;
    if (failCount >= this.config.maxRetries) {
      return true;
    }

    return false;
  }

  private createWorkflowTask(rec: CorpusRecommendation): WorkflowTask {
    const targetParts = rec.target?.split('-');
    const prefix = targetParts?.[0];
    const value = targetParts?.[1];

    return {
      id: `${rec.action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: rec.action as WorkflowAction,
      documentId: rec.id,
      targetPhase: prefix === 'phase' ? value : undefined,
      targetAdapter: prefix === 'adapter' ? value : undefined,
      priority: rec.priority,
      state: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries
    };
  }

  getNextTask(): WorkflowTask | null {
    const pending = this.taskQueue.filter(t => t.state === 'pending');
    return pending.length > 0 ? pending[0] : null;
  }

  getPendingTasks(): WorkflowTask[] {
    return this.taskQueue.filter(t => t.state === 'pending');
  }

  getRunningTasks(): WorkflowTask[] {
    return this.taskQueue.filter(t => t.state === 'running');
  }

  markTaskRunning(taskId: string): void {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (task) {
      task.state = 'running';
      task.startedAt = Date.now();
    }
  }

  markTaskCompleted(taskId: string): void {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (task) {
      task.state = 'completed';
      task.completedAt = Date.now();
      this.completedTasks.add(`${task.action}-${task.documentId}`);
    }
  }

  markTaskFailed(taskId: string, error: string): void {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (task) {
      task.retryCount++;
      if (task.retryCount >= task.maxRetries) {
        task.state = 'failed';
        task.error = error;
        this.failedTasks.set(`${task.action}-${task.documentId}`, task.retryCount);
      } else {
        task.state = 'pending'; // Retry
      }
    }
  }

  getStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    return {
      pending: this.taskQueue.filter(t => t.state === 'pending').length,
      running: this.taskQueue.filter(t => t.state === 'running').length,
      completed: this.taskQueue.filter(t => t.state === 'completed').length,
      failed: this.taskQueue.filter(t => t.state === 'failed').length
    };
  }
}
