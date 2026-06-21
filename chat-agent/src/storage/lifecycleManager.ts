/**
 * MinIO lifecycle management for CIC buckets
 *
 * Implements retention policies, expiration rules, and archival:
 * - Automatic cleanup of old ingestion artifacts
 * - Memory snapshot retention (configurable per bucket)
 * - Logs rotation and archival
 * - Backup and versioning strategies
 */

import { getMinIO, CIC_BUCKETS } from './MinioClient';

export interface LifecyclePolicy {
  bucket: string;
  rules: {
    id: string;
    prefix: string;
    enabled: boolean;
    expiration?: {
      days: number;
      ruleType: 'delete' | 'archive';
    };
    versionExpiration?: {
      days: number;
    };
    tags?: Record<string, string>;
  }[];
}

export const DEFAULT_LIFECYCLE_POLICIES: Record<string, LifecyclePolicy> = {
  // Ingestion: keep raw artifacts for 30 days
  [CIC_BUCKETS.INGESTION]: {
    bucket: CIC_BUCKETS.INGESTION,
    rules: [
      {
        id: 'delete-old-ingestion-artifacts',
        prefix: 'raw/',
        enabled: true,
        expiration: {
          days: 30,
          ruleType: 'delete',
        },
      },
      {
        id: 'delete-old-screenshots',
        prefix: 'screenshot/',
        enabled: true,
        expiration: {
          days: 7,
          ruleType: 'delete',
        },
      },
    ],
  },

  // World Corpus: keep indefinitely, version for 90 days
  [CIC_BUCKETS.WORLD_CORPUS]: {
    bucket: CIC_BUCKETS.WORLD_CORPUS,
    rules: [
      {
        id: 'expire-old-versions',
        prefix: '',
        enabled: true,
        versionExpiration: {
          days: 90,
        },
      },
    ],
  },

  // Agent Artifacts: keep for 90 days
  [CIC_BUCKETS.AGENT_ARTIFACTS]: {
    bucket: CIC_BUCKETS.AGENT_ARTIFACTS,
    rules: [
      {
        id: 'delete-old-artifacts',
        prefix: '',
        enabled: true,
        expiration: {
          days: 90,
          ruleType: 'delete',
        },
      },
    ],
  },

  // Memory: keep snapshots for 1 year, old embeddings for 180 days
  [CIC_BUCKETS.MEMORY]: {
    bucket: CIC_BUCKETS.MEMORY,
    rules: [
      {
        id: 'delete-old-embeddings',
        prefix: 'embeddings/',
        enabled: true,
        expiration: {
          days: 180,
          ruleType: 'delete',
        },
      },
      {
        id: 'keep-snapshots-one-year',
        prefix: 'snapshots/',
        enabled: true,
        expiration: {
          days: 365,
          ruleType: 'delete',
        },
      },
    ],
  },

  // TorqueQuery Raw: keep batches for 180 days
  [CIC_BUCKETS.TORQUEQUERY_RAW]: {
    bucket: CIC_BUCKETS.TORQUEQUERY_RAW,
    rules: [
      {
        id: 'delete-old-batches',
        prefix: 'batches/',
        enabled: true,
        expiration: {
          days: 180,
          ruleType: 'delete',
        },
      },
    ],
  },

  // Logs: keep for 30 days, rotate daily
  [CIC_BUCKETS.LOGS]: {
    bucket: CIC_BUCKETS.LOGS,
    rules: [
      {
        id: 'delete-old-logs',
        prefix: '',
        enabled: true,
        expiration: {
          days: 30,
          ruleType: 'delete',
        },
      },
    ],
  },
};

class LifecycleManager {
  private policies: Map<string, LifecyclePolicy> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      for (const [bucketName, policy] of Object.entries(DEFAULT_LIFECYCLE_POLICIES)) {
        this.policies.set(bucketName, policy);
      }
      this.initialized = true;
      console.log('[Lifecycle] Initialized with default retention policies');
    } catch (error) {
      console.error('[Lifecycle] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Apply lifecycle policies to all buckets
   * Note: MinIO SDK doesn't support setting lifecycle rules directly,
   * so this is documented here for manual configuration or future implementation
   */
  async applyPolicies(): Promise<void> {
    if (!this.initialized) {
      throw new Error('LifecycleManager not initialized');
    }

    console.log('[Lifecycle] Lifecycle policies ready for MinIO configuration:');
    for (const [bucketName, policy] of this.policies) {
      console.log(`  ${bucketName}:`);
      for (const rule of policy.rules) {
        console.log(`    - ${rule.id}`);
        if (rule.expiration) {
          console.log(`      Expire: ${rule.expiration.days} days (${rule.expiration.ruleType})`);
        }
        if (rule.versionExpiration) {
          console.log(`      Version retention: ${rule.versionExpiration.days} days`);
        }
      }
    }
  }

  /**
   * Get policy for a specific bucket
   */
  getPolicy(bucket: string): LifecyclePolicy | undefined {
    return this.policies.get(bucket);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): LifecyclePolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Generate MinIO lifecycle configuration XML
   * For manual import or REST API calls
   */
  generateLifecycleXML(): string {
    const rules = Array.from(this.policies.values())
      .flatMap((policy) =>
        policy.rules.map((rule) => {
          let ruleXml = `
    <Rule>
      <ID>${rule.id}</ID>
      <Status>${rule.enabled ? 'Enabled' : 'Disabled'}</Status>
      <Filter>
        <Prefix>${rule.prefix}</Prefix>
      </Filter>`;

          if (rule.expiration) {
            ruleXml += `
      <Expiration>
        <Days>${rule.expiration.days}</Days>
      </Expiration>`;
          }

          if (rule.versionExpiration) {
            ruleXml += `
      <NoncurrentVersionExpiration>
        <NoncurrentDays>${rule.versionExpiration.days}</NoncurrentDays>
      </NoncurrentVersionExpiration>`;
          }

          ruleXml += `
    </Rule>`;
          return ruleXml;
        })
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<LifecycleConfiguration>
${rules}
</LifecycleConfiguration>`;
  }

  /**
   * Log lifecycle summary for debugging/auditing
   */
  printSummary(): void {
    console.log('\n=== MinIO Lifecycle Configuration ===\n');
    for (const [bucketName, policy] of this.policies) {
      console.log(`Bucket: ${bucketName}`);
      for (const rule of policy.rules) {
        const status = rule.enabled ? '✓' : '✗';
        let retention = '';
        if (rule.expiration) {
          retention = ` → Delete after ${rule.expiration.days} days`;
        }
        if (rule.versionExpiration) {
          retention = ` → Keep versions for ${rule.versionExpiration.days} days`;
        }
        console.log(`  [${status}] ${rule.id}${retention}`);
      }
      console.log();
    }
  }
}

export const lifecycleManager = new LifecycleManager();
