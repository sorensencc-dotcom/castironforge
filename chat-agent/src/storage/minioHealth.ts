import { testMinIOHealth } from './MinioClient';

export interface MinIOHealthStatus {
  status: 'healthy' | 'unhealthy' | 'error';
  timestamp: number;
  message: string;
  latencyMs?: number;
}

export async function checkMinIOHealth(): Promise<MinIOHealthStatus> {
  const startTime = Date.now();

  try {
    const isHealthy = await testMinIOHealth();
    const latencyMs = Date.now() - startTime;

    if (isHealthy) {
      return {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'MinIO is operational',
        latencyMs,
      };
    } else {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        message: 'MinIO health check failed',
        latencyMs,
      };
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'error',
      timestamp: Date.now(),
      message: error instanceof Error ? error.message : 'Unknown error during MinIO health check',
      latencyMs,
    };
  }
}

let lastHealthStatus: MinIOHealthStatus | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

export function startMinIOHealthMonitoring(intervalMs: number = 30000): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Perform initial health check
  checkMinIOHealth().then((status) => {
    lastHealthStatus = status;
    console.log(`[MinIO Health] ${status.status.toUpperCase()}: ${status.message} (${status.latencyMs}ms)`);
  });

  // Start periodic health checks
  healthCheckInterval = setInterval(async () => {
    try {
      const status = await checkMinIOHealth();
      lastHealthStatus = status;
      if (status.status !== 'healthy') {
        console.warn(`[MinIO Health] ${status.status.toUpperCase()}: ${status.message}`);
      }
    } catch (error) {
      console.error('[MinIO Health] Error during periodic check:', error);
    }
  }, intervalMs);
}

export function stopMinIOHealthMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

export function getLastHealthStatus(): MinIOHealthStatus | null {
  return lastHealthStatus;
}
