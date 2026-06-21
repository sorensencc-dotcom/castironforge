import { Agent, AgentMessage, MessageType, AgentRole } from './types';

export abstract class BaseAgent implements Agent {
  id: string;
  role: AgentRole;
  name: string;
  healthy: boolean = true;
  lastHeartbeat: number = Date.now();
  private messageHandlers: Map<MessageType, (msg: AgentMessage) => Promise<void>> = new Map();

  constructor(id: string, role: AgentRole, name: string) {
    this.id = id;
    this.role = role;
    this.name = name;
  }

  /**
   * Initialize agent and register message handlers
   */
  async initialize(): Promise<void> {
    this.registerMessageHandlers();
    console.log(`[${this.role}:${this.name}] Initialized`);
  }

  /**
   * Subclasses override this to register their handlers
   */
  protected abstract registerMessageHandlers(): void;

  /**
   * Handle incoming message
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    this.lastHeartbeat = Date.now();

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    } else {
      console.warn(
        `[${this.role}:${this.name}] No handler for message type: ${message.type}`
      );
    }
  }

  /**
   * Register a message handler
   */
  protected registerHandler(
    type: MessageType,
    handler: (msg: AgentMessage) => Promise<void>
  ): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Get agent status
   */
  getStatus(): Agent {
    return {
      id: this.id,
      role: this.role,
      name: this.name,
      healthy: this.healthy,
      lastHeartbeat: this.lastHeartbeat
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    // Heartbeat timeout = 60 seconds
    const isHealthy = Date.now() - this.lastHeartbeat < 60000;
    this.healthy = isHealthy;
    return isHealthy;
  }
}
