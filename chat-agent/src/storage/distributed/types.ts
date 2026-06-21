export interface DatacenterConfig {
  id: string;
  name: string;
  endpoints: string[];
  accessKey: string;
  secretKey: string;
  region: string;
  priority: number;
  healthCheckInterval: number;
}

export interface DistributedMinIOConfig {
  datacenters: DatacenterConfig[];
  replicationStrategy: 'active-passive' | 'active-active';
  conflictResolution: 'last-write-wins' | 'vector-clock' | 'custom';
  syncInterval: number;
  maxRetries: number;
  retryBackoffMs: number;
}

export interface ReplicationEvent {
  id: string;
  bucket: string;
  key: string;
  operation: 'put' | 'delete' | 'copy' | 'metadata-update';
  sourceDC: string;
  timestamp: number;
  sha256: string;
  metadata?: Record<string, any>;
}

export interface DatacenterHealth {
  id: string;
  healthy: boolean;
  lastCheck: number;
  latencyMs: number;
  failureCount: number;
}

export interface SyncStatus {
  sourceDC: string;
  targetDC: string;
  lastSyncTime: number;
  pendingEvents: number;
  syncLagMs: number;
  conflictCount: number;
}
