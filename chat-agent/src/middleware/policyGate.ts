import { Request, Response, NextFunction } from 'express';

export interface PolicyConfig {
  // Token budget per session
  maxTokensPerSession?: number;
  // Token budget per day
  maxTokensPerDay?: number;
  // Allowed model prefixes (e.g., ["local:*", "sharing:dbrx*"])
  allowedModels?: string[];
  // Max concurrent requests
  maxConcurrentRequests?: number;
  // Rate limit: requests per minute
  ratelimitPerMinute?: number;
  // Blocked models (takes precedence over allowlist)
  blockedModels?: string[];
}

interface SessionTokens {
  sessionId: string;
  tokens: number;
  lastReset: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

class PolicyEnforcer {
  private config: PolicyConfig;
  private sessionTokens: Map<string, SessionTokens> = new Map();
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();
  private concurrentRequests: number = 0;

  constructor(config: PolicyConfig = {}) {
    this.config = {
      maxTokensPerSession: 1_000_000,
      maxTokensPerDay: 10_000_000,
      allowedModels: ['*'],
      maxConcurrentRequests: 10,
      ratelimitPerMinute: 120,
      ...config
    };

    // Cleanup stale session tokens every 30 minutes
    setInterval(() => this.cleanupStaleSessions(), 30 * 60 * 1000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only enforce on chat-related endpoints
      if (!this.isChatRequest(req)) {
        return next();
      }

      const { sessionId, model } = this.extractRequestInfo(req);

      // Check policies
      const policyError = this.checkPolicies(sessionId, model);
      if (policyError) {
        return res.status(policyError.status).json({ error: policyError.message });
      }

      // Increment concurrent requests
      if (this.config.maxConcurrentRequests && this.concurrentRequests >= this.config.maxConcurrentRequests) {
        return res.status(429).json({ error: 'Max concurrent requests exceeded' });
      }
      this.concurrentRequests++;

      // Clean up on response
      const originalSend = res.send.bind(res);
      res.send = (data: any) => {
        this.concurrentRequests--;
        return originalSend(data);
      };

      next();
    };
  }

  recordTokens(sessionId: string, tokensUsed: number): void {
    const existing = this.sessionTokens.get(sessionId);
    if (existing) {
      existing.tokens += tokensUsed;
    } else {
      this.sessionTokens.set(sessionId, {
        sessionId,
        tokens: tokensUsed,
        lastReset: Date.now()
      });
    }
  }

  getSessionTokens(sessionId: string): number {
    return this.sessionTokens.get(sessionId)?.tokens ?? 0;
  }

  private checkPolicies(sessionId: string, model: string): { status: number; message: string } | null {
    // 1. Check model allowlist
    if (!this.isModelAllowed(model)) {
      return { status: 403, message: `Model '${model}' is not allowed` };
    }

    // 2. Check model blocklist
    if (this.isModelBlocked(model)) {
      return { status: 403, message: `Model '${model}' is blocked` };
    }

    // 3. Check session token budget
    const sessionTokens = this.getSessionTokens(sessionId);
    if (this.config.maxTokensPerSession && sessionTokens >= this.config.maxTokensPerSession) {
      return { status: 429, message: 'Session token budget exhausted' };
    }

    // 4. Check rate limit
    if (!this.checkRateLimit(sessionId)) {
      return { status: 429, message: 'Rate limit exceeded' };
    }

    return null;
  }

  private isModelAllowed(model: string): boolean {
    if (!this.config.allowedModels || this.config.allowedModels.length === 0) {
      return true;
    }

    return this.config.allowedModels.some(pattern => this.matchesPattern(model, pattern));
  }

  private isModelBlocked(model: string): boolean {
    if (!this.config.blockedModels || this.config.blockedModels.length === 0) {
      return false;
    }

    return this.config.blockedModels.some(pattern => this.matchesPattern(model, pattern));
  }

  private matchesPattern(model: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    // Simple glob matching: "local:*" matches "local:qwen", "local:phi"
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return model.startsWith(prefix);
    }

    return model === pattern;
  }

  private checkRateLimit(sessionId: string): boolean {
    if (!this.config.ratelimitPerMinute) {
      return true;
    }

    const now = Date.now();
    const bucket = this.rateLimitBuckets.get(sessionId);

    if (!bucket || now > bucket.resetAt) {
      // New bucket
      this.rateLimitBuckets.set(sessionId, {
        count: 1,
        resetAt: now + 60 * 1000
      });
      return true;
    }

    if (bucket.count >= this.config.ratelimitPerMinute) {
      return false;
    }

    bucket.count++;
    return true;
  }

  private isChatRequest(req: Request): boolean {
    return req.method === 'POST' && (req.path === '/chat' || req.path.startsWith('/chat/'));
  }

  private extractRequestInfo(req: Request): { sessionId: string; model: string } {
    if (req.method === 'POST') {
      const { sessionId = 'anonymous', model = 'local:default' } = req.body;
      return { sessionId, model };
    }

    // GET requests (streaming)
    const { sessionId = 'anonymous', model = 'local:default' } = req.query;
    return {
      sessionId: String(sessionId),
      model: String(model)
    };
  }

  private cleanupStaleSessions(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [sessionId, session] of this.sessionTokens.entries()) {
      if (session.lastReset < oneHourAgo) {
        this.sessionTokens.delete(sessionId);
        this.rateLimitBuckets.delete(sessionId);
      }
    }
  }
}

// Singleton instance
export const policyEnforcer = new PolicyEnforcer();

// Helper function for operator config
export function createPolicyEnforcer(config: PolicyConfig): PolicyEnforcer {
  return new PolicyEnforcer(config);
}
