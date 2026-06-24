/**
 * SLO Violation Webhook Alerting
 *
 * Publishes SLO violations to external webhooks for alerting systems.
 * Supports multiple webhook destinations (Slack, PagerDuty, email, etc.)
 * with batching, retry logic, and dead-letter handling.
 */

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

export enum ViolationDomain {
  Latency = 'latency',
  ErrorRate = 'error_rate',
  Saturation = 'saturation',
}

export interface SLOViolationEvent {
  id: string;
  timestamp: number;
  domain: ViolationDomain;
  severity: number; // 1-3
  message: string;
  metrics?: {
    value: number;
    threshold: number;
    percentile?: string;
  };
  affectedAdapters?: string[];
  enforementAction?: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
  retryCount?: number;
  retryDelayMs?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  violation: SLOViolationEvent;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'dead_letter';
  error?: string;
  timestamp: number;
  responseCode?: number;
}

export class SLOViolationWebhook {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryQueue: WebhookDelivery[] = [];
  private deliveryHistory: WebhookDelivery[] = [];
  private deadLetterQueue: WebhookDelivery[] = [];
  private processingInterval: NodeJS.Timer | null = null;

  constructor() {
    // Process webhook queue periodically
    this.processingInterval = setInterval(() => this.processQueue(), 5000);
  }

  /**
   * Register a webhook destination
   */
  registerWebhook(config: WebhookConfig): void {
    this.webhooks.set(config.id, {
      ...config,
      retryCount: config.retryCount ?? 3,
      retryDelayMs: config.retryDelayMs ?? 5000,
      timeout: config.timeout ?? 10000,
    });
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId: string): boolean {
    return this.webhooks.delete(webhookId);
  }

  /**
   * Publish a violation to all registered webhooks
   */
  publishViolation(violation: Omit<SLOViolationEvent, 'id' | 'timestamp'>): void {
    const event: SLOViolationEvent = {
      ...violation,
      id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    // Queue delivery to all enabled webhooks
    for (const webhook of this.webhooks.values()) {
      if (webhook.enabled) {
        const delivery: WebhookDelivery = {
          id: `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          webhookId: webhook.id,
          violation: event,
          attempt: 1,
          status: 'pending',
          timestamp: Date.now(),
        };

        this.deliveryQueue.push(delivery);
      }
    }
  }

  /**
   * Process pending webhook deliveries
   */
  private async processQueue(): Promise<void> {
    const pending = this.deliveryQueue.filter(d => d.status === 'pending');

    for (const delivery of pending) {
      const webhook = this.webhooks.get(delivery.webhookId);
      if (!webhook) {
        delivery.status = 'failed';
        continue;
      }

      try {
        const response = await this.sendWebhook(webhook, delivery.violation);

        if (response.ok) {
          delivery.status = 'success';
          delivery.responseCode = response.status;
          this.deliveryHistory.push(delivery);
        } else {
          if (delivery.attempt < (webhook.retryCount ?? 3)) {
            delivery.attempt++;
            delivery.status = 'pending';
            // Retry will happen on next cycle
          } else {
            delivery.status = 'dead_letter';
            delivery.error = `HTTP ${response.status}: ${response.statusText}`;
            this.deadLetterQueue.push(delivery);
          }
        }
      } catch (err) {
        delivery.error = err instanceof Error ? err.message : String(err);

        if (delivery.attempt < (webhook.retryCount ?? 3)) {
          delivery.attempt++;
          delivery.status = 'pending';
        } else {
          delivery.status = 'dead_letter';
          this.deadLetterQueue.push(delivery);
        }
      }
    }

    // Remove processed deliveries from queue
    this.deliveryQueue = this.deliveryQueue.filter(d => d.status === 'pending');
  }

  /**
   * Send webhook to destination
   */
  private async sendWebhook(
    webhook: WebhookConfig,
    violation: SLOViolationEvent
  ): Promise<Response> {
    const payload = this.buildPayload(webhook, violation);

    return fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...webhook.headers,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(webhook.timeout ?? 10000),
    });
  }

  /**
   * Build webhook payload (can be customized per webhook type)
   */
  private buildPayload(webhook: WebhookConfig, violation: SLOViolationEvent): unknown {
    // Detect webhook type by URL and format payload accordingly
    if (webhook.url.includes('slack.com')) {
      return this.buildSlackPayload(violation);
    } else if (webhook.url.includes('pagerduty.com')) {
      return this.buildPagerDutyPayload(violation);
    }

    // Default payload
    return {
      event: 'slo_violation',
      violation,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build Slack-formatted payload
   */
  private buildSlackPayload(violation: SLOViolationEvent): unknown {
    const colorMap = { 1: '#FFA500', 2: '#FF6B6B', 3: '#8B0000' };

    return {
      text: `SLO Violation: ${violation.domain}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `⚠️ SLO Violation Detected`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Domain:*\n${violation.domain}`,
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${this.severityLabel(violation.severity)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Message:*\n${violation.message}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date(violation.timestamp).toISOString()}`,
            },
          ],
        },
      ],
      attachments: [
        {
          color: colorMap[violation.severity as keyof typeof colorMap] || '#999999',
          fields: violation.metrics
            ? [
                {
                  title: 'Metrics',
                  value: `Value: ${violation.metrics.value}, Threshold: ${violation.metrics.threshold}`,
                  short: false,
                },
              ]
            : [],
        },
      ],
    };
  }

  /**
   * Build PagerDuty-formatted payload
   */
  private buildPagerDutyPayload(violation: SLOViolationEvent): unknown {
    return {
      routing_key: 'placeholder', // Should be set in webhook config
      event_action: 'trigger',
      payload: {
        summary: `SLO Violation: ${violation.domain}`,
        severity: this.severityLabel(violation.severity),
        source: 'CIC-SLO-Controller',
        custom_details: violation,
      },
    };
  }

  /**
   * Get delivery history
   */
  getDeliveryHistory(webhookId?: string, limit: number = 100): WebhookDelivery[] {
    if (webhookId) {
      return this.deliveryHistory
        .filter(d => d.webhookId === webhookId)
        .slice(-limit);
    }
    return this.deliveryHistory.slice(-limit);
  }

  /**
   * Get dead-letter queue
   */
  getDeadLetterQueue(limit: number = 100): WebhookDelivery[] {
    return this.deadLetterQueue.slice(-limit);
  }

  /**
   * Retry dead-letter deliveries
   */
  async retryDeadLetters(webhookId?: string): Promise<number> {
    const toRetry = webhookId
      ? this.deadLetterQueue.filter(d => d.webhookId === webhookId)
      : this.deadLetterQueue;

    for (const delivery of toRetry) {
      delivery.attempt = 1;
      delivery.status = 'pending';
      this.deliveryQueue.push(delivery);
    }

    // Remove from dead-letter
    this.deadLetterQueue = this.deadLetterQueue.filter(
      d => !toRetry.find(tr => tr.id === d.id)
    );

    // Process immediately
    await this.processQueue();

    return toRetry.length;
  }

  /**
   * Get webhook statistics
   */
  getStatistics(webhookId?: string) {
    const history = webhookId
      ? this.deliveryHistory.filter(d => d.webhookId === webhookId)
      : this.deliveryHistory;

    const successful = history.filter(d => d.status === 'success').length;
    const failed = this.deadLetterQueue.filter(
      d => !webhookId || d.webhookId === webhookId
    ).length;

    return {
      total: history.length + failed,
      successful,
      failed,
      successRate: history.length + failed > 0
        ? successful / (history.length + failed)
        : 0,
      pending: this.deliveryQueue.filter(
        d => !webhookId || d.webhookId === webhookId
      ).length,
    };
  }

  /**
   * Get list of registered webhooks
   */
  getWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  private severityLabel(severity: number): string {
    return { 1: 'low', 2: 'medium', 3: 'critical' }[severity] || 'unknown';
  }
}

// Singleton instance
let instance: SLOViolationWebhook | null = null;

export function initializeSLOWebhook(): SLOViolationWebhook {
  if (!instance) {
    instance = new SLOViolationWebhook();
  }
  return instance;
}

export function getSLOWebhook(): SLOViolationWebhook {
  if (!instance) {
    instance = new SLOViolationWebhook();
  }
  return instance;
}
