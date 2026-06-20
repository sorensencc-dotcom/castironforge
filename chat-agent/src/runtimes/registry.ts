import type { RuntimeAdapter, RuntimeModel, HealthStatus } from './types';

export interface RuntimeRegistration {
  prefix: string;
  adapter: RuntimeAdapter;
  priority?: number;
}

export class RuntimeRegistry {
  private registrations: Map<string, RuntimeAdapter> = new Map();
  private prefixOrder: string[] = [];

  register(prefix: string, adapter: RuntimeAdapter, priority: number = 100): void {
    this.registrations.set(prefix, adapter);
    this.prefixOrder.push(prefix);
    this.prefixOrder.sort((a, b) => {
      // Higher priority first
      const registryA = this.registrations.get(a)!;
      const registryB = this.registrations.get(b)!;
      return (registryB as any).priority - (registryA as any).priority;
    });
  }

  unregister(prefix: string): void {
    this.registrations.delete(prefix);
    this.prefixOrder = this.prefixOrder.filter(p => p !== prefix);
  }

  resolve(modelId: string): RuntimeAdapter {
    const prefix = this.extractPrefix(modelId);
    if (!prefix) {
      throw new Error(`No prefix found in model ID: ${modelId}`);
    }

    const adapter = this.registrations.get(prefix);
    if (!adapter) {
      throw new Error(`Unknown model prefix: ${prefix}`);
    }

    return adapter;
  }

  async getModels(): Promise<RuntimeModel[]> {
    const models: RuntimeModel[] = [];

    for (const prefix of this.prefixOrder) {
      const adapter = this.registrations.get(prefix)!;
      try {
        const adapterModels = await adapter.models().catch(() => []);
        models.push(...adapterModels);
      } catch {
        // Silently skip unavailable runtimes
      }
    }

    return models;
  }

  async getHealth(): Promise<Record<string, HealthStatus>> {
    const health: Record<string, HealthStatus> = {};

    const healthChecks = Array.from(this.registrations.entries()).map(
      async ([prefix, adapter]) => {
        try {
          health[prefix] = await adapter.health();
        } catch {
          health[prefix] = 'error';
        }
      }
    );

    await Promise.all(healthChecks);
    return health;
  }

  private extractPrefix(modelId: string): string | null {
    // Find longest matching prefix
    for (const prefix of this.prefixOrder) {
      if (modelId.startsWith(`${prefix}:`)) {
        return prefix;
      }
    }
    return null;
  }

  listPrefixes(): string[] {
    return [...this.prefixOrder];
  }
}

// Singleton instance
export const runtimeRegistry = new RuntimeRegistry();
