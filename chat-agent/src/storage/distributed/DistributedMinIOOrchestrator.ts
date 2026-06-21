import { DistributedMinIOClient } from './DistributedMinIOClient';
import { ReplicationEngine } from './ReplicationEngine';
import { FailoverManager } from './FailoverManager';
import { DistributedMetricsCollector } from './DistributedMetricsCollector';
import { DistributedMinIOConfig } from './types';

export class DistributedMinIOOrchestrator {
  private minioClient: DistributedMinIOClient;
  private replicationEngine: ReplicationEngine;
  private failoverManager: FailoverManager;
  private metricsCollector: DistributedMetricsCollector;
  private isRunning: boolean = false;

  constructor(config: DistributedMinIOConfig) {
    this.minioClient = new DistributedMinIOClient(config);
    this.replicationEngine = new ReplicationEngine(this.minioClient, config.syncInterval);
    this.failoverManager = new FailoverManager(this.minioClient);
    this.metricsCollector = new DistributedMetricsCollector(
      this.minioClient,
      this.replicationEngine,
      this.failoverManager
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[DistributedMinIOOrchestrator] Starting...');

    // Start all subsystems
    this.failoverManager.start();
    this.metricsCollector.start();
    await this.replicationEngine.start();

    this.isRunning = true;
    console.log('[DistributedMinIOOrchestrator] Started successfully');
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('[DistributedMinIOOrchestrator] Stopping...');

    this.replicationEngine.stop();
    this.failoverManager.stop();
    this.metricsCollector.stop();

    this.isRunning = false;
    console.log('[DistributedMinIOOrchestrator] Stopped');
  }

  getMinIOClient(): DistributedMinIOClient {
    return this.minioClient;
  }

  getReplicationEngine(): ReplicationEngine {
    return this.replicationEngine;
  }

  getFailoverManager(): FailoverManager {
    return this.failoverManager;
  }

  getMetricsCollector(): DistributedMetricsCollector {
    return this.metricsCollector;
  }

  getStatus(): {
    running: boolean;
    activeDC: string;
    metrics: Record<string, any>;
  } {
    return {
      running: this.isRunning,
      activeDC: this.minioClient.getActiveDC(),
      metrics: this.metricsCollector.export()
    };
  }
}

export { DistributedMinIOClient, ReplicationEngine, FailoverManager, DistributedMetricsCollector };
