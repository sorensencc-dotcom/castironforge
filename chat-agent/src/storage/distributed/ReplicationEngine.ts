import { DistributedMinIOClient } from './DistributedMinIOClient';
import { ReplicationEvent, SyncStatus } from './types';

export interface ReplicationQueue {
  events: ReplicationEvent[];
  lastProcessed: number;
}

export class ReplicationEngine {
  private queues: Map<string, ReplicationQueue> = new Map();
  private syncStatus: Map<string, SyncStatus> = new Map();
  private minioClient: DistributedMinIOClient;
  private isRunning: boolean = false;

  constructor(minioClient: DistributedMinIOClient, private syncIntervalMs: number = 1000) {
    this.minioClient = minioClient;
    this.initializeQueues();
  }

  private initializeQueues(): void {
    const datacenters = this.minioClient.getHealthStatus();
    for (const dc of datacenters) {
      this.queues.set(`${dc.id}-sync`, { events: [], lastProcessed: Date.now() });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.processSyncCycles();
      } catch (error) {
        console.error('Replication cycle error:', error);
      }
      await this.sleep(this.syncIntervalMs);
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  async enqueueEvent(event: ReplicationEvent): Promise<void> {
    const clients = this.minioClient.getAllClients();

    for (const [dcId, _] of clients) {
      if (dcId !== event.sourceDC) {
        const queueKey = `${dcId}-sync`;
        const queue = this.queues.get(queueKey);
        if (queue) {
          queue.events.push(event);
        }
      }
    }
  }

  private async processSyncCycles(): Promise<void> {
    for (const [queueKey, queue] of this.queues) {
      if (queue.events.length === 0) continue;

      const dcId = queueKey.replace('-sync', '');
      const startTime = Date.now();

      try {
        for (const event of queue.events) {
          await this.replicateEvent(dcId, event);
        }

        queue.events = [];
        this.updateSyncStatus(event.sourceDC, dcId, startTime);
      } catch (error) {
        console.error(`Sync failed for DC ${dcId}:`, error);
      }
    }
  }

  private async replicateEvent(targetDC: string, event: ReplicationEvent): Promise<void> {
    const sourceClient = this.minioClient.getClientForDC(event.sourceDC);
    const targetClient = this.minioClient.getClientForDC(targetDC);

    try {
      if (event.operation === 'put' || event.operation === 'copy') {
        // Copy object from source to target
        await this.copyObject(sourceClient, targetClient, event.bucket, event.key);
      } else if (event.operation === 'delete') {
        // Delete from target
        await targetClient.removeObject(event.bucket, event.key);
      } else if (event.operation === 'metadata-update') {
        // Update metadata
        await this.updateMetadata(targetClient, event);
      }
    } catch (error) {
      throw new Error(
        `Failed to replicate ${event.operation} of ${event.bucket}/${event.key}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async copyObject(sourceClient: any, targetClient: any, bucket: string, key: string): Promise<void> {
    const stream = await sourceClient.getObject(bucket, key);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await targetClient.putObject(bucket, key, buffer, buffer.length);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      stream.on('error', reject);
    });
  }

  private async updateMetadata(client: any, event: ReplicationEvent): Promise<void> {
    if (!event.metadata) return;
    // Metadata update logic - typically copy with new metadata
    const stream = await client.getObject(event.bucket, event.key);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await client.putObject(event.bucket, event.key, buffer, buffer.length, event.metadata);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      stream.on('error', reject);
    });
  }

  private updateSyncStatus(sourceDC: string, targetDC: string, startTime: number): void {
    const key = `${sourceDC}->${targetDC}`;
    const existing = this.syncStatus.get(key) || {
      sourceDC,
      targetDC,
      lastSyncTime: 0,
      pendingEvents: 0,
      syncLagMs: 0,
      conflictCount: 0
    };

    existing.lastSyncTime = Date.now();
    existing.syncLagMs = Date.now() - startTime;
    this.syncStatus.set(key, existing);
  }

  getSyncStatus(): SyncStatus[] {
    return Array.from(this.syncStatus.values());
  }

  getPendingEventCount(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.events.length;
    }
    return total;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
