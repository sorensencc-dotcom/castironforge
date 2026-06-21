export type AgentRole = 'curator' | 'indexer' | 'expander';

export type MessageType =
  | 'ANNOUNCE'
  | 'PROPOSE'
  | 'VOTE'
  | 'EXECUTE'
  | 'REPORT'
  | 'CONFLICT'
  | 'HEARTBEAT';

export type VoteDecision = 'agree' | 'disagree' | 'abstain';

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  healthy: boolean;
  lastHeartbeat: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  type: MessageType;
  timestamp: number;
  content: Record<string, any>;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ActionProposal {
  id: string;
  proposedBy: string;
  action: string;
  details: Record<string, any>;
  targetPhase?: string;
  targetAdapter?: string;
  estimatedDuration?: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  votes?: Map<string, VoteDecision>;
  consensus?: boolean;
}

export interface CoordinationMetrics {
  agentId: string;
  role: AgentRole;
  actionsProposed: number;
  actionsExecuted: number;
  successRate: number;
  avgLatencyMs: number;
  consensusParticipation: number;
}

export interface CollectiveMetrics {
  timestamp: number;
  activeAgents: number;
  totalProposals: number;
  successfulExecutions: number;
  failedExecutions: number;
  consensusRate: number;
  avgConflictResolutionMs: number;
  corpusHealth: {
    totalDocs: number;
    qualityScore: number;
    indexHealth: number;
  };
}
