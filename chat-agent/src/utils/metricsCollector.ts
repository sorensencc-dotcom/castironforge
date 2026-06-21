interface Timer {
  end(): number;
}

class MetricsCollector {
  private counters = new Map<string, number>();
  private timers = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  start(label: string): Timer {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.recordHistogram(`${label}_latency_ms`, duration);
        return duration;
      }
    };
  }

  increment(label: string, amount: number = 1): void {
    this.counters.set(label, (this.counters.get(label) ?? 0) + amount);
  }

  recordHistogram(label: string, value: number): void {
    const values = this.histograms.get(label) ?? [];
    values.push(value);
    this.histograms.set(label, values);
  }

  getCounter(label: string): number {
    return this.counters.get(label) ?? 0;
  }

  getHistogram(label: string): {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p99: number;
  } | null {
    const values = this.histograms.get(label);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sorted.reduce((a, b) => a + b) / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  getAllMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return [
            key,
            {
              count: values.length,
              min: sorted[0],
              max: sorted[sorted.length - 1],
              avg: sorted.reduce((a, b) => a + b) / sorted.length,
              p50: sorted[Math.floor(sorted.length * 0.5)],
              p99: sorted[Math.floor(sorted.length * 0.99)]
            }
          ];
        })
      )
    };
  }

  reset(): void {
    this.counters.clear();
    this.timers.clear();
    this.histograms.clear();
  }
}

export const metricsCollector = new MetricsCollector();
