/**
 * Credential management for OpenSharing and other external services
 *
 * Features:
 * - Cache credentials with expiry tracking
 * - Auto-refresh before expiration (with buffer time)
 * - Graceful fallback on refresh failure
 * - Concurrent refresh prevention (debounce)
 */

export interface Credentials {
  token: string;
  expiryTime: number;            // Unix timestamp (ms)
  storageUrl: string;
  storageType: 'aws' | 'azure' | 'gcs' | 'r2';
  refreshToken?: string;         // For refresh flow (optional)
}

export interface CredentialRequest {
  shareNamespace: string;
  assetName: string;
  assetVersion: string;
  accessType: 'read' | 'readwrite';
}

export type CredentialProvider = (request: CredentialRequest) => Promise<Credentials>;

/**
 * Credential manager with auto-refresh
 */
export class CredentialManager {
  private cache: Map<string, Credentials> = new Map();
  private refreshInProgress: Map<string, Promise<Credentials>> = new Map();
  private provider: CredentialProvider;
  private refreshBufferMs: number;           // Refresh this many ms before expiry
  private checkIntervalMs: number;           // How often to check for expired creds

  constructor(provider: CredentialProvider, refreshBufferMs: number = 5 * 60 * 1000) {
    this.provider = provider;
    this.refreshBufferMs = refreshBufferMs; // Default: refresh 5 minutes before expiry
    this.checkIntervalMs = 60 * 1000;       // Check every minute

    // Start background refresh check
    this.startBackgroundRefresh();
  }

  /**
   * Get credentials (use cached if fresh, refresh if needed)
   */
  async getCredentials(request: CredentialRequest): Promise<Credentials> {
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);

    // If cached and not expired, return it
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    // If a refresh is already in progress, wait for it
    const inProgress = this.refreshInProgress.get(cacheKey);
    if (inProgress) {
      return inProgress;
    }

    // Otherwise, refresh
    const refreshPromise = this.refresh(request);
    this.refreshInProgress.set(cacheKey, refreshPromise);

    try {
      const credentials = await refreshPromise;
      this.cache.set(cacheKey, credentials);
      return credentials;
    } finally {
      this.refreshInProgress.delete(cacheKey);
    }
  }

  /**
   * Manually refresh credentials
   */
  async refreshCredentials(request: CredentialRequest): Promise<Credentials> {
    const cacheKey = this.getCacheKey(request);
    const credentials = await this.refresh(request);
    this.cache.set(cacheKey, credentials);
    return credentials;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific credentials
   */
  clearCredentials(request: CredentialRequest): void {
    const cacheKey = this.getCacheKey(request);
    this.cache.delete(cacheKey);
  }

  /**
   * Get cache size (for monitoring)
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  // ==================== Private Helpers ====================

  private async refresh(request: CredentialRequest): Promise<Credentials> {
    try {
      const credentials = await this.provider(request);

      if (credentials.expiryTime <= Date.now()) {
        throw new Error('Provider returned already-expired credentials');
      }

      return credentials;
    } catch (err) {
      console.error('[CredentialManager] Failed to refresh credentials:', err);

      // Check if cached version exists (even if expired)
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        console.warn('[CredentialManager] Falling back to cached (possibly expired) credentials');
        return cached;
      }

      // No cached version, propagate error
      throw new Error(`Failed to get credentials for ${cacheKey}: ${err}`);
    }
  }

  private isExpired(creds: Credentials): boolean {
    const now = Date.now();
    const refreshTime = creds.expiryTime - this.refreshBufferMs;
    return now > refreshTime;
  }

  private getCacheKey(request: CredentialRequest): string {
    return `${request.shareNamespace}:${request.assetName}:${request.assetVersion}`;
  }

  private startBackgroundRefresh(): void {
    setInterval(() => {
      // Find all credentials that need refresh
      const toRefresh: Array<{
        key: string;
        creds: Credentials;
      }> = [];

      for (const [key, creds] of this.cache.entries()) {
        if (this.isExpired(creds)) {
          toRefresh.push({ key, creds });
        }
      }

      // Attempt background refresh (don't await, just fire and forget)
      for (const { key, creds } of toRefresh) {
        const [namespace, assetName, assetVersion] = key.split(':');
        this.refreshCredentials({
          shareNamespace: namespace,
          assetName,
          assetVersion,
          accessType: 'read'
        }).catch(err => {
          console.error(`[CredentialManager] Background refresh failed for ${key}:`, err);
        });
      }
    }, this.checkIntervalMs);
  }
}

/**
 * OpenSharing credential provider
 */
export async function createOpenSharingCredentialProvider(
  opensharingUrl: string,
  principalId: string
): Promise<CredentialProvider> {
  return async (request: CredentialRequest): Promise<Credentials> => {
    const res = await fetch(`${opensharingUrl}/credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${principalId}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!res.ok) {
      throw new Error(`Failed to get credentials: HTTP ${res.status}`);
    }

    const data = (await res.json()) as Credentials;
    return data;
  };
}

// Singleton instance
let credentialManager: CredentialManager | null = null;

export function getCredentialManager(): CredentialManager {
  if (!credentialManager) {
    throw new Error('CredentialManager not initialized. Call initializeCredentialManager first.');
  }
  return credentialManager;
}

export async function initializeCredentialManager(
  opensharingUrl: string,
  principalId: string
): Promise<CredentialManager> {
  const provider = await createOpenSharingCredentialProvider(opensharingUrl, principalId);
  credentialManager = new CredentialManager(provider);
  return credentialManager;
}
