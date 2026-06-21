import { RecommendationsEngine } from '../corpus/introspection/RecommendationsEngine';
import { CorpusSummaryBuilder } from '../corpus/introspection/CorpusSummary';
import { DecisionEngine } from './DecisionEngine';
import { Reindexer } from './Reindexer';
import { Reembedder } from './Reembedder';
import { IngestionOrchestrator } from './IngestionOrchestrator';
import { WorkflowManager } from './WorkflowManager';
import { AutonomousConfig } from './types';

export class AutonomousOrchestrator {
  private recommendationsEngine: RecommendationsEngine;
  private decisionEngine: DecisionEngine;
  private workflowManager: WorkflowManager;
  private maintenanceInterval: NodeJS.Timer | null = null;
  private isRunning: boolean = false;

  constructor(
    private config: AutonomousConfig,
    private embeddingService: any
  ) {
    this.recommendationsEngine = new RecommendationsEngine();
    this.decisionEngine = new DecisionEngine(config);

    const reindexer = new Reindexer();
    const reembedder = new Reembedder(embeddingService);
    const summaryBuilder = new CorpusSummaryBuilder();
    const ingestionOrchestrator = new IngestionOrchestrator(summaryBuilder);

    this.workflowManager = new WorkflowManager(config, reindexer, reembedder, ingestionOrchestrator);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[AutonomousOrchestrator] Starting...');

    // Start workflow manager
    await this.workflowManager.start();

    // Start maintenance check loop
    this.maintenanceInterval = setInterval(() => {
      this.runMaintenanceCycle().catch(error => {
        console.error('[AutonomousOrchestrator] Maintenance cycle error:', error);
      });
    }, this.config.checkIntervalMs);

    console.log('[AutonomousOrchestrator] Started successfully');
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('[AutonomousOrchestrator] Stopping...');

    this.workflowManager.stop();

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    this.isRunning = false;
    console.log('[AutonomousOrchestrator] Stopped');
  }

  private async runMaintenanceCycle(): Promise<void> {
    try {
      // 1. Get corpus recommendations
      const recommendations = await this.recommendationsEngine.run();

      if (recommendations.length === 0) {
        return;
      }

      // 2. Submit to workflow manager
      const taskCount = await this.workflowManager.submitRecommendations(recommendations);

      console.log(
        `[AutonomousOrchestrator] Maintenance cycle: ${taskCount} workflows submitted, stats:`,
        this.workflowManager.getStats()
      );
    } catch (error) {
      console.error('[AutonomousOrchestrator] Maintenance cycle failed:', error);
    }
  }

  getStatus(): {
    running: boolean;
    autonomyLevel: string;
    workflowStats: Record<string, any>;
  } {
    return {
      running: this.isRunning,
      autonomyLevel: this.config.autonomyLevel,
      workflowStats: this.workflowManager.getStats()
    };
  }
}

export { DecisionEngine, Reindexer, Reembedder, IngestionOrchestrator, WorkflowManager };
