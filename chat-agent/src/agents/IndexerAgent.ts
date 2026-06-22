import { BaseAgent } from './BaseAgent';
import { AgentMessage } from './types';

export class IndexerAgent extends BaseAgent {
  private reindexCount: number = 0;
  private reembedCount: number = 0;

  constructor(id: string) {
    super(id, 'indexer', 'Indexer');
  }

  protected registerMessageHandlers(): void {
    this.registerHandler('ANNOUNCE', async (msg: AgentMessage) => {
      console.log(`[Indexer] Received announcement:`, msg.content);
    });

    this.registerHandler('PROPOSE', async (msg: AgentMessage) => {
      const proposal = msg.content;
      console.log(`[Indexer] Evaluating proposal:`, proposal);

      // Indexer agrees with indexing-related proposals
      const decision = proposal.action === 'reindex' || proposal.action === 'reembed' ? 'agree' : 'agree';
      if (this.recordVoteCallback && proposal.id) {
        this.recordVoteCallback(proposal.id, this.id, decision);
      }
    });

    this.registerHandler('EXECUTE', async (msg: AgentMessage) => {
      await this.executeIndexingWorkflow(msg.content);
    });
  }

  private async executeIndexingWorkflow(content: Record<string, any>): Promise<void> {
    const { action, documentIds } = content;

    if (action === 'reindex') {
      await this.reindexDocuments(documentIds);
    } else if (action === 'reembed') {
      await this.reembedVectors(documentIds);
    } else if (action === 'check_health') {
      await this.checkIndexHealth();
    }
  }

  private async reindexDocuments(documentIds: string[]): Promise<void> {
    // Placeholder: actual reindexing logic
    console.log(`[Indexer] Reindexing ${documentIds.length} documents`);
    this.reindexCount += documentIds.length;
  }

  private async reembedVectors(documentIds: string[]): Promise<void> {
    // Placeholder: actual reembedding logic
    console.log(`[Indexer] Reembedding ${documentIds.length} vectors`);
    this.reembedCount += documentIds.length;
  }

  private async checkIndexHealth(): Promise<void> {
    // Placeholder: health check logic
    console.log(`[Indexer] Checking index health`);
  }

  getMetrics(): Record<string, any> {
    return {
      role: 'indexer',
      reindexCount: this.reindexCount,
      reembedCount: this.reembedCount,
      healthy: this.healthy
    };
  }
}
