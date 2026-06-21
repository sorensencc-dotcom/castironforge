import { BaseAgent } from './BaseAgent';
import { AgentMessage, ActionProposal, VoteDecision } from './types';

export class CoordinationBus {
  private agents: Map<string, BaseAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private proposals: Map<string, ActionProposal> = new Map();
  private isRunning: boolean = false;

  /**
   * Register an agent on the bus
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    await agent.initialize();
    this.agents.set(agent.id, agent);
    console.log(`[CoordinationBus] Registered ${agent.role}:${agent.name}`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    console.log(`[CoordinationBus] Unregistered agent ${agentId}`);
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);

    for (const agent of this.agents.values()) {
      try {
        await agent.handleMessage(message);
      } catch (error) {
        console.error(`[CoordinationBus] Error handling message in ${agent.id}:`, error);
      }
    }
  }

  /**
   * Send message to specific agent
   */
  async sendToAgent(agentId: string, message: AgentMessage): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.messageQueue.push(message);
    await agent.handleMessage(message);
  }

  /**
   * Submit proposal for consensus voting
   */
  async submitProposal(proposal: ActionProposal): Promise<boolean> {
    proposal.votes = new Map();
    this.proposals.set(proposal.id, proposal);

    console.log(
      `[CoordinationBus] Proposal submitted by ${proposal.proposedBy}: ${proposal.action}`
    );

    // Broadcast proposal to all agents
    await this.broadcast({
      id: `prop-${proposal.id}`,
      from: proposal.proposedBy,
      type: 'PROPOSE',
      timestamp: Date.now(),
      content: proposal,
      priority: proposal.priority
    });

    // Collect votes
    await this.collectVotes(proposal);

    // Check consensus
    const hasConsensus = this.checkConsensus(proposal);
    proposal.consensus = hasConsensus;

    return hasConsensus;
  }

  /**
   * Record vote from agent
   */
  recordVote(proposalId: string, agentId: string, decision: VoteDecision): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (!proposal.votes) {
      proposal.votes = new Map();
    }

    proposal.votes.set(agentId, decision);
  }

  /**
   * Wait for votes to be collected (simplified - in production use proper async)
   */
  private async collectVotes(proposal: ActionProposal, timeoutMs: number = 5000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, timeoutMs));
  }

  /**
   * Check if consensus is reached
   */
  private checkConsensus(proposal: ActionProposal): boolean {
    if (!proposal.votes || proposal.votes.size === 0) {
      return false;
    }

    const totalAgents = this.agents.size;
    const requiredQuorum = Math.ceil(totalAgents * (2 / 3)); // 2/3 majority
    const agreeCount = Array.from(proposal.votes.values()).filter(v => v === 'agree').length;

    return agreeCount >= requiredQuorum;
  }

  /**
   * Get proposal status
   */
  getProposalStatus(proposalId: string): ActionProposal | null {
    return this.proposals.get(proposalId) || null;
  }

  /**
   * Get all active agents
   */
  getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by role
   */
  getAgentsByRole(role: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter(a => a.role === role);
  }

  /**
   * Start bus operations
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[CoordinationBus] Started');
  }

  /**
   * Stop bus operations
   */
  stop(): void {
    this.isRunning = false;
    console.log('[CoordinationBus] Stopped');
  }

  /**
   * Get bus status
   */
  getStatus(): {
    isRunning: boolean;
    agentCount: number;
    messageQueueSize: number;
    activeProposals: number;
  } {
    return {
      isRunning: this.isRunning,
      agentCount: this.agents.size,
      messageQueueSize: this.messageQueue.length,
      activeProposals: this.proposals.size
    };
  }
}
