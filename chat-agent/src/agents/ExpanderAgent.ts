import { BaseAgent } from './BaseAgent';
import { AgentMessage } from './types';
import { IngestionOrchestrator } from '../autonomous/IngestionOrchestrator';
import { CorpusSummaryBuilder } from '../corpus/introspection/CorpusSummary';

export class ExpanderAgent extends BaseAgent {
  private ingestCount: number = 0;
  private gapIdentificationCount: number = 0;
  private ingestionOrchestrator: IngestionOrchestrator;

  constructor(id: string) {
    super(id, 'expander', 'Expander');
    this.ingestionOrchestrator = new IngestionOrchestrator(new CorpusSummaryBuilder());
  }

  protected registerMessageHandlers(): void {
    this.registerHandler('ANNOUNCE', async (msg: AgentMessage) => {
      console.log(`[Expander] Received announcement:`, msg.content);
    });

    this.registerHandler('PROPOSE', async (msg: AgentMessage) => {
      const proposal = msg.content;
      console.log(`[Expander] Evaluating proposal:`, proposal);

      // Expander agrees with expansion-related proposals
      const decision = proposal.action === 'identify_gaps' || proposal.action === 'expand_phase' ? 'agree' : 'agree';
      if (this.recordVoteCallback && proposal.id) {
        this.recordVoteCallback(proposal.id, this.id, decision);
      }
    });

    this.registerHandler('EXECUTE', async (msg: AgentMessage) => {
      await this.executeExpansionWorkflow(msg.content);
    });
  }

  private async executeExpansionWorkflow(content: Record<string, any>): Promise<void> {
    const { action, phase, adapter } = content;

    if (action === 'identify_gaps') {
      await this.identifyGaps();
    } else if (action === 'expand_phase') {
      await this.expandPhase(phase);
    } else if (action === 'expand_adapter') {
      await this.expandAdapter(adapter);
    }
  }

  private async identifyGaps(): Promise<void> {
    try {
      const targets = await this.ingestionOrchestrator.identifyExpansionTargets();
      console.log(`[Expander] Identified ${targets.length} expansion gaps`);
      this.gapIdentificationCount += targets.length;
    } catch (error) {
      console.error('[Expander] Gap identification failed:', error);
    }
  }

  private async expandPhase(phase: string): Promise<void> {
    // Placeholder: phase expansion logic
    console.log(`[Expander] Expanding corpus for Phase-${phase}`);
    this.ingestCount++;
  }

  private async expandAdapter(adapter: string): Promise<void> {
    // Placeholder: adapter expansion logic
    console.log(`[Expander] Expanding corpus for ${adapter} adapter`);
    this.ingestCount++;
  }

  getMetrics(): Record<string, any> {
    return {
      role: 'expander',
      ingestCount: this.ingestCount,
      gapIdentificationCount: this.gapIdentificationCount,
      healthy: this.healthy
    };
  }
}
