import { Client } from 'minio';
import { DatacenterConfig, DistributedMinIOConfig, DatacenterHealth } from './types';

export class DistributedMinIOClient {
  private clients: Map<string, Client> = new Map();
  private config: DistributedMinIOConfig;
  private healthStatus: Map<string, DatacenterHealth> = new Map();
  private activeDC: string;

  constructor(config: DistributedMinIOConfig) {
    this.config = config;
    this.activeDC = this.getHighestPriorityDC();
    this.initializeClients();
  }

  private initializeClients(): void {
    for (const dc of this.config.datacenters) {
      const client = new Client({
        endPoint: dc.endpoints[0].split('://')[1].split(':')[0],
        port: parseInt(dc.endpoints[0].split(':').pop() || '9000', 10),
        useSSL: dc.endpoints[0].startsWith('https'),
        accessKey: dc.accessKey,
        secretKey: dc.secretKey,
        region: dc.region
      });

      this.clients.set(dc.id, client);

      // Initialize health status
      this.healthStatus.set(dc.id, {
        id: dc.id,
        healthy: true,
        lastCheck: Date.now(),
        latencyMs: 0,
        failureCount: 0
      });
    }
  }

  private getHighestPriorityDC(): string {
    return this.config.datacenters.reduce((prev, current) =>
      current.priority > prev.priority ? current : prev
    ).id;
  }

  async checkHealth(): Promise<void> {
    const checks = this.config.datacenters.map(dc => this.healthCheckDC(dc.id));
    await Promise.all(checks);

    // Update active DC if current one is unhealthy
    const activeHealth = this.healthStatus.get(this.activeDC);
    if (activeHealth && !activeHealth.healthy) {
      this.activeDC = this.getHealthyDC();
    }
  }

  private async healthCheckDC(dcId: string): Promise<void> {
    const startTime = Date.now();
    try {
      const client = this.clients.get(dcId);
      if (!client) return;

      await client.listBuckets();

      const health = this.healthStatus.get(dcId)!;
      health.healthy = true;
      health.lastCheck = Date.now();
      health.latencyMs = Date.now() - startTime;
      health.failureCount = 0;
    } catch (error) {
      const health = this.healthStatus.get(dcId)!;
      health.healthy = false;
      health.failureCount++;
      health.lastCheck = Date.now();
      health.latencyMs = Date.now() - startTime;
    }
  }

  private getHealthyDC(): string {
    const healthyDCs = this.config.datacenters
      .filter(dc => {
        const health = this.healthStatus.get(dc.id);
        return health?.healthy;
      })
      .sort((a, b) => b.priority - a.priority);

    return healthyDCs.length > 0 ? healthyDCs[0].id : this.activeDC;
  }

  getActiveClient(): Client {
    const client = this.clients.get(this.activeDC);
    if (!client) {
      throw new Error(`No client available for active DC: ${this.activeDC}`);
    }
    return client;
  }

  getClientForDC(dcId: string): Client {
    const client = this.clients.get(dcId);
    if (!client) {
      throw new Error(`No client available for DC: ${dcId}`);
    }
    return client;
  }

  getAllClients(): Map<string, Client> {
    return this.clients;
  }

  getHealthStatus(): DatacenterHealth[] {
    return Array.from(this.healthStatus.values());
  }

  getActiveDC(): string {
    return this.activeDC;
  }

  isHealthy(): boolean {
    return this.healthStatus.get(this.activeDC)?.healthy ?? false;
  }
}
