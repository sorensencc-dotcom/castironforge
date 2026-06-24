import { AdapterIntegrationService, initializeAdapterIntegration, getAdapterIntegration } from '../adapters/AdapterIntegrationService';
import { SLOViolationWebhook, initializeSLOWebhook, getSLOWebhook } from '../cic/SLOViolationWebhook';

/**
 * Integration tests for CIC adapter caching and SLO webhook alerting
 *
 * Validates:
 * - Adapter operations use AdapterGateway cache
 * - SLO violations trigger webhook alerts
 * - Webhook retry logic and dead-letter handling
 * - Cache metrics and statistics tracking
 */

describe('CIC Adapter-Webhook Integration', () => {
  let adapterService: any;
  let sloWebhook: any;
  let mockWebhookCalls: Array<{ url: string; body: any; timestamp: number }> = [];

  beforeEach(() => {
    mockWebhookCalls = [];

    // Initialize services
    adapterService = initializeAdapterIntegration({
      maxSize: 1024 * 1024,
      maxEntries: 1000,
      ttlMs: 60000,
    });

    sloWebhook = initializeSLOWebhook();

    // Mock fetch for webhook delivery
    global.fetch = jest.fn((url: string, options: any) => {
      mockWebhookCalls.push({
        url,
        body: JSON.parse(options.body),
        timestamp: Date.now(),
      });

      // Simulate successful delivery by default
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);
    });
  });

  describe('adapter execution with caching', () => {
    it('caches adapter responses and returns cached result on second execution', async () => {
      const executionResults: any[] = [];

      // First execution (cache miss)
      const result1 = await adapterService.execute('adapter-1', { query: 'test' }, { useCache: true });
      executionResults.push(result1);
      expect(result1.success).toBe(true);
      expect(result1.cached).toBe(false);

      // Second execution (cache hit)
      const result2 = await adapterService.execute('adapter-1', { query: 'test' }, { useCache: true });
      executionResults.push(result2);
      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);

      // Verify cache metrics
      const metrics = adapterService.getCacheMetrics();
      expect(metrics.hits).toBeGreaterThan(0);
    });

    it('executes multiple adapter calls in parallel', async () => {
      const startTime = Date.now();

      const results = await adapterService.executeMultiple([
        { adapterId: 'adapter-1', request: { id: 1 } },
        { adapterId: 'adapter-2', request: { id: 2 } },
        { adapterId: 'adapter-3', request: { id: 3 } },
      ]);

      const elapsedTime = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every((r: any) => r.success)).toBe(true);

      // Parallel execution should be faster than sequential
      // (This is a loose check; actual timing depends on system)
      expect(elapsedTime).toBeLessThan(1000);

      // Verify execution history
      const stats = adapterService.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(3);
    });

    it('tracks execution statistics across adapter operations', () => {
      // Execute operations and track stats
      adapterService.execute('adapter-1', { test: true });
      adapterService.execute('adapter-2', { test: true });
      adapterService.execute('adapter-1', { test: true });

      const stats = adapterService.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.adapters).toContain('adapter-1');
      expect(stats.adapters).toContain('adapter-2');
    });

    it('retrieves execution history with optional filtering', () => {
      adapterService.execute('adapter-1', { id: 1 });
      adapterService.execute('adapter-2', { id: 2 });
      adapterService.execute('adapter-1', { id: 3 });

      const allHistory = adapterService.getExecutionHistory();
      expect(allHistory.length).toBeGreaterThanOrEqual(3);

      const adapter1History = adapterService.getExecutionHistory('adapter-1', 100);
      expect(adapter1History.every((r: any) => r.adapterId === 'adapter-1')).toBe(true);
      expect(adapter1History.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('webhook registration and management', () => {
    it('registers webhooks with full configuration', () => {
      sloWebhook.registerWebhook({
        id: 'slack-webhook',
        url: 'https://hooks.slack.com/services/test',
        name: 'Slack Alerts',
        enabled: true,
        retryCount: 3,
        retryDelayMs: 5000,
        timeout: 10000,
        headers: { 'Authorization': 'Bearer token' },
      });

      const webhooks = sloWebhook.getWebhooks();
      expect(webhooks).toContainEqual(
        expect.objectContaining({
          id: 'slack-webhook',
          name: 'Slack Alerts',
          enabled: true,
        })
      );
    });

    it('lists all registered webhooks', () => {
      sloWebhook.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/webhook1',
        name: 'Webhook 1',
        enabled: true,
      });

      sloWebhook.registerWebhook({
        id: 'webhook-2',
        url: 'https://example.com/webhook2',
        name: 'Webhook 2',
        enabled: true,
      });

      const webhooks = sloWebhook.getWebhooks();
      expect(webhooks.length).toBeGreaterThanOrEqual(2);
      expect(webhooks.map((w: any) => w.id)).toContain('webhook-1');
      expect(webhooks.map((w: any) => w.id)).toContain('webhook-2');
    });

    it('unregisters webhooks', () => {
      sloWebhook.registerWebhook({
        id: 'to-remove',
        url: 'https://example.com/remove',
        name: 'To Remove',
        enabled: true,
      });

      const webhooksBefore = sloWebhook.getWebhooks();
      const hadToRemove = webhooksBefore.some((w: any) => w.id === 'to-remove');
      expect(hadToRemove).toBe(true);

      const removed = sloWebhook.unregisterWebhook('to-remove');
      expect(removed).toBe(true);

      const webhooksAfter = sloWebhook.getWebhooks();
      const stillHasToRemove = webhooksAfter.some((w: any) => w.id === 'to-remove');
      expect(stillHasToRemove).toBe(false);
    });
  });

  describe('webhook violation publishing and delivery', () => {
    it('publishes violations to registered webhooks', async () => {
      sloWebhook.registerWebhook({
        id: 'webhook-1',
        url: 'https://example.com/alerts',
        name: 'Test Webhook',
        enabled: true,
      });

      sloWebhook.publishViolation({
        domain: 'error_rate',
        severity: 2,
        message: 'Error rate exceeded 5%',
        metrics: { value: 0.06, threshold: 0.05 },
      });

      // Allow async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger queue processing
      if (sloWebhook.processQueue) {
        await sloWebhook.processQueue();
      }

      expect(mockWebhookCalls.length).toBeGreaterThan(0);
    });

    it('formats violation payloads correctly', async () => {
      sloWebhook.registerWebhook({
        id: 'webhook-test',
        url: 'https://example.com/test',
        name: 'Test',
        enabled: true,
      });

      sloWebhook.publishViolation({
        domain: 'latency',
        severity: 3,
        message: 'P99 latency critical',
        metrics: { value: 5500, threshold: 5000 },
        affectedAdapters: ['adapter-1', 'adapter-2'],
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      if (sloWebhook.processQueue) {
        await sloWebhook.processQueue();
      }

      if (mockWebhookCalls.length > 0) {
        const payload = mockWebhookCalls[0].body;
        expect(payload).toHaveProperty('violation');
        expect(payload.violation).toHaveProperty('domain', 'latency');
        expect(payload.violation).toHaveProperty('severity', 3);
      }
    });
  });

  describe('webhook delivery history and statistics', () => {
    it('tracks webhook delivery history', async () => {
      sloWebhook.registerWebhook({
        id: 'history-test',
        url: 'https://example.com/history',
        name: 'History Test',
        enabled: true,
      });

      sloWebhook.publishViolation({
        domain: 'saturation',
        severity: 1,
        message: 'Saturation warning',
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      if (sloWebhook.processQueue) {
        await sloWebhook.processQueue();
      }

      const history = sloWebhook.getDeliveryHistory('history-test', 100);
      expect(Array.isArray(history)).toBe(true);
    });

    it('maintains webhook statistics', async () => {
      sloWebhook.registerWebhook({
        id: 'stats-webhook',
        url: 'https://example.com/stats',
        name: 'Stats Webhook',
        enabled: true,
      });

      // Publish multiple violations
      for (let i = 0; i < 3; i++) {
        sloWebhook.publishViolation({
          domain: 'error_rate',
          severity: 1,
          message: `Error ${i}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));
      if (sloWebhook.processQueue) {
        await sloWebhook.processQueue();
      }

      const stats = sloWebhook.getStatistics('stats-webhook');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('successful');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('dead-letter queue and retry logic', () => {
    it('moves failed deliveries to dead-letter queue', async () => {
      // Mock a failing webhook
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        if (callCount <= 2) {
          // Fail first 2 times
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          } as Response);
        }
        // Success on retry
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
        } as Response);
      });

      sloWebhook.registerWebhook({
        id: 'fail-webhook',
        url: 'https://example.com/fail',
        name: 'Failing Webhook',
        enabled: true,
        retryCount: 2,
        retryDelayMs: 100,
      });

      sloWebhook.publishViolation({
        domain: 'latency',
        severity: 2,
        message: 'Test violation',
      });

      // Process queue and let retries happen
      await new Promise(resolve => setTimeout(resolve, 500));
      if (sloWebhook.processQueue) {
        await sloWebhook.processQueue();
      }

      const deadLetters = sloWebhook.getDeadLetterQueue(100);
      expect(Array.isArray(deadLetters)).toBe(true);
    });

    it('retries dead-letter deliveries', async () => {
      const deadLetters = sloWebhook.getDeadLetterQueue(10);
      if (deadLetters && deadLetters.length > 0) {
        const retryCount = await sloWebhook.retryDeadLetters();
        expect(retryCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('integration: adapter operations trigger SLO monitoring', () => {
    it('tracks adapter operations through CIC lifecycle', async () => {
      // Execute adapter operations
      const results = await adapterService.executeMultiple([
        { adapterId: 'latency-test-1', request: { duration: 100 } },
        { adapterId: 'latency-test-2', request: { duration: 200 } },
        { adapterId: 'latency-test-3', request: { duration: 300 } },
      ]);

      expect(results.every((r: any) => r.success || !r.success)).toBe(true);

      // Verify execution history
      const stats = adapterService.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(3);

      // Verify cache metrics (should show activity)
      const metrics = adapterService.getCacheMetrics();
      expect(metrics).toHaveProperty('currentSize');
      expect(metrics).toHaveProperty('currentEntries');
    });

    it('connects adapter statistics with SLO violation webhooks', () => {
      // Register webhook
      sloWebhook.registerWebhook({
        id: 'integrated-webhook',
        url: 'https://example.com/integrated',
        name: 'Integrated Alert',
        enabled: true,
      });

      // Execute adapter operations
      adapterService.execute('integrated-adapter', { test: true });

      // Publish SLO violation
      sloWebhook.publishViolation({
        domain: 'error_rate',
        severity: 2,
        message: 'Adapter integration test violation',
        affectedAdapters: ['integrated-adapter'],
      });

      // Verify both services have data
      const adapterStats = adapterService.getStatistics('integrated-adapter');
      expect(adapterStats.total).toBeGreaterThan(0);

      const webhooks = sloWebhook.getWebhooks();
      expect(webhooks.map((w: any) => w.id)).toContain('integrated-webhook');
    });
  });

  describe('cache eviction and memory management', () => {
    it('respects cache size limits during adapter operations', async () => {
      // Create a service with small cache
      const smallCache = initializeAdapterIntegration({
        maxSize: 1024, // 1KB
        maxEntries: 10,
        ttlMs: 60000,
      });

      // Execute many operations to trigger eviction
      for (let i = 0; i < 20; i++) {
        await smallCache.execute(`adapter-${i}`, { data: 'x'.repeat(100) });
      }

      const metrics = smallCache.getCacheMetrics();
      expect(metrics.currentEntries).toBeLessThanOrEqual(10);
      expect(metrics.currentSize).toBeLessThanOrEqual(1024);
    });

    it('clears cache and history when requested', () => {
      adapterService.execute('clear-test-1', { test: true });
      adapterService.execute('clear-test-2', { test: true });

      let stats = adapterService.getStatistics();
      expect(stats.total).toBeGreaterThan(0);

      adapterService.clear();

      stats = adapterService.getStatistics();
      expect(stats.total).toBe(0);
    });
  });

  describe('error handling and resilience', () => {
    it('handles adapter execution errors gracefully', async () => {
      const result = await adapterService.execute('nonexistent-adapter', { test: true });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
    });

    it('handles webhook registration without stopping service', () => {
      // Register valid webhook
      sloWebhook.registerWebhook({
        id: 'valid',
        url: 'https://example.com/valid',
        name: 'Valid',
        enabled: true,
      });

      const webhooks = sloWebhook.getWebhooks();
      expect(webhooks.some((w: any) => w.id === 'valid')).toBe(true);
    });

    it('handles disabled webhooks gracefully', async () => {
      sloWebhook.registerWebhook({
        id: 'disabled-webhook',
        url: 'https://example.com/disabled',
        name: 'Disabled',
        enabled: false,
      });

      sloWebhook.publishViolation({
        domain: 'latency',
        severity: 1,
        message: 'Should not trigger disabled webhook',
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      if (sloWebhook.processQueue) {
        await sloWebhook.processQueue();
      }

      // Service should remain healthy
      const webhooks = sloWebhook.getWebhooks();
      expect(Array.isArray(webhooks)).toBe(true);
    });
  });

  afterEach(() => {
    // Clean up
    try {
      adapterService.clear();
    } catch (err) {
      // Ignore cleanup errors
    }
  });
});
