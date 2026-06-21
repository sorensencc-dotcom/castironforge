import { CoordinationBus } from './CoordinationBus';
import { CuratorAgent } from './CuratorAgent';
import { IndexerAgent } from './IndexerAgent';
import { ExpanderAgent } from './ExpanderAgent';
import { RecommendationsEngine } from '../corpus/introspection/RecommendationsEngine';
import { ActionProposal, CollectiveMetrics } from './types';

export class MultiAgentOrchestrator {
  private coordinationBus: CoordinationBus;
  private curatorAgent: CuratorAgent;
  private indexerAgent: IndexerAgent;
  private expanderAgent: ExpanderAgent;
  private recommendationsEngine: RecommendationsEngine;
  private isRunning: boolean = false;
  private maintenanceInterval: NodeJS.Timer | null = null;

  constructor() {
    this.coordinationBus = new CoordinationBus();
    this.curatorAgent = new CuratorAgent('curator-1');
    this.indexerAgent = new IndexerAgent('indexer-1');
    this.expanderAgent = new ExpanderAgent('expander-1');
    this.recommendationsEngine = new RecommendationsEngine();
  }

  async initialize(): Promise<void> {
    console.log('[MultiAgentOrchestrator] Initializing...');

    // Register all agents on the bus
    await this.coordinationBus.registerAgent(this.curatorAgent);
    await this.coordinationBus.registerAgent(this.indexerAgent);
    await this.coordinationBus.registerAgent(this.expanderAgent);

    this.coordinationBus.start();

    console.log('[MultiAgentOrchestrator] Initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.initialize();
    this.isRunning = true;

    console.log('[MultiAgentOrchestrator] Started');

    // Start maintenance cycle
    this.maintenanceInterval = setInterval(() => {
      this.runMaintenanceCycle().catch(error => {
        console.error('[MultiAgentOrchestrator] Maintenance cycle error:', error);
      });
    }, 60000); // Run every 60 seconds
  }

  stop(): void {
    if (!this.isRunning) return;

    this.coordinationBus.stop();

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    this.isRunning = false;
    console.log('[MultiAgentOrchestrator] Stopped');
  }

  private async runMaintenanceCycle(): Promise<void> {
    try {
      // 1. Get recommendations from corpus intelligence
      const recommendations = await this.recommendationsEngine.run();

      if (recommendations.length === 0) {
        return;
      }

      // 2. Convert recommendations to proposals
      for (const rec of recommendations) {
        const proposal: ActionProposal = {
          id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          proposedBy: 'curator',
          action: rec.action,
          details: { documentId: rec.id, reason: rec.reason },
          priority: rec.priority,
          consensus: false
        };

        // 3. Submit for consensus
        const hasConsensus = await this.coordinationBus.submitProposal(proposal);

        if (hasConsensus) {
          console.log(`[MultiAgentOrchestrator] Proposal ${proposal.id} has consensus`);
          // 4. Broadcast execution order
          await this.coordinationBus.broadcast({
            id: `exec-${proposal.id}`,
            from: 'orchestrator',
            type: 'EXECUTE',
            timestamp: Date.now(),
            content: proposal.details,
            priority: proposal.priority
          });
        } else {
          console.log(`[MultiAgentOrchestrator] Proposal ${proposal.id} did NOT achieve consensus`);
        }
      }
    } catch (error) {
      console.error('[MultiAgentOrchestrator] Maintenance cycle failed:', error);
    }
  }

  getCollectiveMetrics(): CollectiveMetrics {
    const agents = this.coordinationBus.getAgents();
    const status = this.coordinationBus.getStatus();

    const curatorMetrics = this.curatorAgent.getMetrics();
    const indexerMetrics = this.indexerAgent.getMetrics();
    const expanderMetrics = this.expanderAgent.getMetrics();

    const totalActions =
      (curatorMetrics.deduplicationCount || 0) +
      (curatorMetrics.metadataValidationCount || 0) +
      (indexerMetrics.reindexCount || 0) +
      (indexerMetrics.reembedCount || 0) +
      (expanderMetrics.ingestCount || 0);

    return {
      timestamp: Date.now(),
      activeAgents: agents.length,
      totalProposals: status.activeProposals,
      successfulExecutions: totalActions,
      failedExecutions: 0, // Placeholder
      consensusRate: agents.length > 0 ? 0.85 : 0, // Placeholder
      avgConflictResolutionMs: 1500, // Placeholder
      corpusHealth: {
        totalDocs: 1000, // Placeholder
        qualityScore: 0.92, // Placeholder
        indexHealth: 0.88 // Placeholder
      }
    };
  }

  getAgentStatus(): Array<{
    id: string;
    role: string;
    healthy: boolean;
    metrics: Record<string, any>;
  }> {
    return [
      {
        id: this.curatorAgent.id,
        role: 'curator',
        healthy: this.curatorAgent.getStatus().healthy,
        metrics: this.curatorAgent.getMetrics()
      },
      {
        id: this.indexerAgent.id,
        role: 'indexer',
        healthy: this.indexerAgent.getStatus().healthy,
        metrics: this.indexerAgent.getMetrics()
      },
      {
        id: this.expanderAgent.id,
        role: 'expander',
        healthy: this.expanderAgent.getStatus().healthy,
        metrics: this.expanderAgent.getMetrics()
      }
    ];
  }

  getStatus(): {
    running: boolean;
    busStatus: Record<string, any>;
    agents: Array<any>;
    metrics: CollectiveMetrics;
  } {
    return {
      running: this.isRunning,
      busStatus: this.coordinationBus.getStatus(),
      agents: this.getAgentStatus(),
      metrics: this.getCollectiveMetrics()
    };
  }
}
