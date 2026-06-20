import type { PolicyConfig } from './policyGate';

/**
 * Load policy configuration from environment variables
 *
 * Supported env vars:
 * - POLICY_MAX_TOKENS_PER_SESSION (number, default: 1000000)
 * - POLICY_MAX_TOKENS_PER_DAY (number, default: 10000000)
 * - POLICY_ALLOWED_MODELS (comma-separated, default: "*")
 * - POLICY_BLOCKED_MODELS (comma-separated, default: "")
 * - POLICY_MAX_CONCURRENT_REQUESTS (number, default: 10)
 * - POLICY_RATELIMIT_PER_MINUTE (number, default: 120)
 */
export function loadPolicyConfig(): PolicyConfig {
  const parseNumber = (key: string, fallback: number): number => {
    const value = process.env[key];
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  };

  const parseList = (key: string, fallback: string[]): string[] => {
    const value = process.env[key];
    if (!value) return fallback;
    return value.split(',').map(s => s.trim());
  };

  return {
    maxTokensPerSession: parseNumber('POLICY_MAX_TOKENS_PER_SESSION', 1_000_000),
    maxTokensPerDay: parseNumber('POLICY_MAX_TOKENS_PER_DAY', 10_000_000),
    allowedModels: parseList('POLICY_ALLOWED_MODELS', ['*']),
    blockedModels: parseList('POLICY_BLOCKED_MODELS', []),
    maxConcurrentRequests: parseNumber('POLICY_MAX_CONCURRENT_REQUESTS', 10),
    ratelimitPerMinute: parseNumber('POLICY_RATELIMIT_PER_MINUTE', 120)
  };
}

/**
 * Example configurations for common scenarios
 */

export const DEVELOPMENT_POLICY: PolicyConfig = {
  maxTokensPerSession: 10_000_000,
  maxTokensPerDay: 100_000_000,
  allowedModels: ['*'],
  maxConcurrentRequests: 50,
  ratelimitPerMinute: 1000
};

export const PRODUCTION_POLICY: PolicyConfig = {
  maxTokensPerSession: 1_000_000,
  maxTokensPerDay: 10_000_000,
  allowedModels: ['local:*', 'cpu:*', 'sharing:dbrx*'],
  blockedModels: ['torque:*'], // RAG-only, not for chat
  maxConcurrentRequests: 10,
  ratelimitPerMinute: 120
};

export const COST_OPTIMIZED_POLICY: PolicyConfig = {
  maxTokensPerSession: 100_000,
  maxTokensPerDay: 1_000_000,
  allowedModels: ['sharing:gemini*'], // Cheapest
  blockedModels: ['sharing:claude*', 'sharing:dbrx*'],
  maxConcurrentRequests: 5,
  ratelimitPerMinute: 60
};

export const HIGH_THROUGHPUT_POLICY: PolicyConfig = {
  maxTokensPerSession: 10_000_000,
  maxTokensPerDay: 100_000_000,
  allowedModels: ['*'],
  maxConcurrentRequests: 100,
  ratelimitPerMinute: 1000
};
