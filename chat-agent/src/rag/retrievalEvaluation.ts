/**
 * R-4: Automated Retrieval Evaluation Loop
 *
 * Remediation for Gap R-4: No retrieval quality monitoring.
 * Scheduled weekly evaluation of retrieval configs against held-out golden question set.
 * Computes RAGAS metrics and alerts when Precision@5 drops >10% week-over-week.
 */

export interface GoldenQuestion {
  id: string;
  question: string;
  expected_docs: string[]; // doc_ids that should be retrieved
  query_variants?: string[]; // Alternative phrasings of same question
}

export interface EvaluationRun {
  run_id: string;
  config_name: string;
  run_timestamp: string;
  questions_evaluated: number;
  metrics: RetrievalMetrics;
  individual_results: EvaluationResult[];
}

export interface EvaluationResult {
  question_id: string;
  question: string;
  retrieved_docs: Array<{ doc_id: string; rank: number; score: number }>;
  relevant_docs: string[];
  precision_at_5: number;
  recall_at_5: number;
  mrr: number; // Mean Reciprocal Rank of first relevant
  ndcg: number; // Normalized Discounted Cumulative Gain
  latency_ms: number;
}

export interface RetrievalMetrics {
  precision_at_k: number;
  recall_at_k: number;
  mrr: number;
  ndcg: number;
  mean_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
}

export interface RetrievalSLO {
  config_name: string;
  precision_at_5_target: number; // e.g., 0.80
  recall_at_5_target: number; // e.g., 0.60
  ndcg_target: number; // e.g., 0.75
  latency_p95_ms_target: number; // e.g., 1000ms
}

export interface EvaluationAlert {
  alert_id: string;
  alert_timestamp: string;
  config_name: string;
  severity: 'warning' | 'critical';
  metric: string; // e.g., 'precision_at_5'
  previous_value: number;
  current_value: number;
  degradation_pct: number; // (current - previous) / previous * 100
  threshold_pct: number; // Alert triggers when change > threshold (e.g., 10%)
  recommendation: string;
}

/**
 * Run evaluation on a single question
 */
export async function evaluateQuestion(
  question: GoldenQuestion,
  retrievalHandler: (q: string) => Promise<Array<{ doc_id: string; score: number; latency_ms: number }>>
): Promise<EvaluationResult> {
  const startTime = Date.now();
  const retrieved = await retrievalHandler(question.question);
  const latency = Date.now() - startTime;

  const retrievedIds = retrieved.map(r => r.doc_id);
  const relevantSet = new Set(question.expected_docs);
  const retrievedSet = new Set(retrievedIds);

  // Precision@5: how many of top-5 are relevant
  const top5 = retrievedIds.slice(0, 5);
  const relevant5 = top5.filter(id => relevantSet.has(id)).length;
  const precision5 = top5.length > 0 ? relevant5 / top5.length : 0;

  // Recall@5: how many of expected docs are in top-5
  const recall5 = question.expected_docs.length > 0 ? relevant5 / question.expected_docs.length : 0;

  // MRR: mean reciprocal rank
  const firstRelevantRank = retrievedIds.findIndex(id => relevantSet.has(id));
  const mrr = firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0;

  // NDCG: normalized discounted cumulative gain
  const dcg = retrievedIds.reduce((sum, id, rank) => {
    const gain = relevantSet.has(id) ? 1 : 0;
    return sum + (gain / Math.log2(rank + 2)); // Log base 2, starting from 1
  }, 0);

  // Ideal DCG (all relevant docs ranked first)
  const idealDcg = question.expected_docs.slice(0, 5).reduce((sum, _, rank) => {
    return sum + (1 / Math.log2(rank + 2));
  }, 0);

  const ndcg = idealDcg > 0 ? dcg / idealDcg : 0;

  return {
    question_id: question.id,
    question: question.question,
    retrieved_docs: retrieved.map((r, idx) => ({
      doc_id: r.doc_id,
      rank: idx + 1,
      score: r.score
    })),
    relevant_docs: question.expected_docs,
    precision_at_5: precision5,
    recall_at_5: recall5,
    mrr,
    ndcg,
    latency_ms: latency
  };
}

/**
 * Run full evaluation on golden question set
 */
export async function runEvaluation(
  runId: string,
  configName: string,
  questions: GoldenQuestion[],
  retrievalHandler: (q: string) => Promise<Array<{ doc_id: string; score: number; latency_ms: number }>>
): Promise<EvaluationRun> {
  const startTime = Date.now();
  const results: EvaluationResult[] = [];

  for (const question of questions) {
    const result = await evaluateQuestion(question, retrievalHandler);
    results.push(result);
  }

  // Aggregate metrics
  const precisions = results.map(r => r.precision_at_5);
  const recalls = results.map(r => r.recall_at_5);
  const mrrs = results.map(r => r.mrr);
  const ndcgs = results.map(r => r.ndcg);
  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b);

  const metrics: RetrievalMetrics = {
    precision_at_k: precisions.reduce((a, b) => a + b, 0) / precisions.length,
    recall_at_k: recalls.reduce((a, b) => a + b, 0) / recalls.length,
    mrr: mrrs.reduce((a, b) => a + b, 0) / mrrs.length,
    ndcg: ndcgs.reduce((a, b) => a + b, 0) / ndcgs.length,
    mean_latency_ms: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p50_latency_ms: latencies[Math.floor(latencies.length * 0.5)],
    p95_latency_ms: latencies[Math.floor(latencies.length * 0.95)],
    p99_latency_ms: latencies[Math.floor(latencies.length * 0.99)]
  };

  return {
    run_id: runId,
    config_name: configName,
    run_timestamp: new Date().toISOString(),
    questions_evaluated: questions.length,
    metrics,
    individual_results: results
  };
}

/**
 * Check SLO compliance and generate alerts
 */
export function checkSLOCompliance(
  currentRun: EvaluationRun,
  previousRun: EvaluationRun | null,
  slo: RetrievalSLO,
  alertThresholdPct: number = 10 // Alert if change > 10%
): EvaluationAlert[] {
  const alerts: EvaluationAlert[] = [];

  // Absolute SLO checks
  if (currentRun.metrics.precision_at_k < slo.precision_at_5_target) {
    alerts.push({
      alert_id: `slo-${currentRun.run_id}-precision`,
      alert_timestamp: currentRun.run_timestamp,
      config_name: currentRun.config_name,
      severity: currentRun.metrics.precision_at_k < slo.precision_at_5_target * 0.8 ? 'critical' : 'warning',
      metric: 'precision_at_5',
      previous_value: previousRun?.metrics.precision_at_k ?? currentRun.metrics.precision_at_k,
      current_value: currentRun.metrics.precision_at_k,
      degradation_pct: previousRun
        ? ((currentRun.metrics.precision_at_k - previousRun.metrics.precision_at_k) / previousRun.metrics.precision_at_k) * 100
        : 0,
      threshold_pct: alertThresholdPct,
      recommendation: `Precision@5 is ${(currentRun.metrics.precision_at_k * 100).toFixed(1)}%, below target ${(slo.precision_at_5_target * 100).toFixed(1)}%. Review retrieval config and rerank strategy.`
    });
  }

  // Week-over-week degradation checks
  if (previousRun) {
    const checkMetric = (
      metricName: string,
      currentValue: number,
      previousValue: number,
      targetValue: number
    ) => {
      const degradationPct = ((currentValue - previousValue) / previousValue) * 100;
      if (Math.abs(degradationPct) > alertThresholdPct) {
        alerts.push({
          alert_id: `wow-${currentRun.run_id}-${metricName}`,
          alert_timestamp: currentRun.run_timestamp,
          config_name: currentRun.config_name,
          severity: degradationPct < -20 ? 'critical' : 'warning',
          metric: metricName,
          previous_value: previousValue,
          current_value: currentValue,
          degradation_pct: degradationPct,
          threshold_pct: alertThresholdPct,
          recommendation:
            degradationPct < 0
              ? `${metricName} dropped ${Math.abs(degradationPct).toFixed(1)}% week-over-week. Investigate retrieval quality changes.`
              : `${metricName} improved ${degradationPct.toFixed(1)}% week-over-week.`
        });
      }
    };

    checkMetric('recall_at_5', currentRun.metrics.recall_at_k, previousRun.metrics.recall_at_k, slo.recall_at_5_target);
    checkMetric('ndcg', currentRun.metrics.ndcg, previousRun.metrics.ndcg, slo.ndcg_target);
    checkMetric('p95_latency_ms', currentRun.metrics.p95_latency_ms, previousRun.metrics.p95_latency_ms, slo.latency_p95_ms_target);
  }

  return alerts;
}

/**
 * Determine if retrieval config needs tuning based on evaluation
 */
export interface TuningRecommendation {
  config_name: string;
  recommendation_type: 'none' | 'increase_top_k' | 'adjust_threshold' | 'enable_rerank' | 'review_index';
  explanation: string;
  priority: 'low' | 'medium' | 'high';
}

export function recommendTuning(evalRun: EvaluationRun): TuningRecommendation {
  const { precision_at_k, recall_at_k, ndcg, mean_latency_ms } = evalRun.metrics;

  if (precision_at_k < 0.5) {
    return {
      config_name: evalRun.config_name,
      recommendation_type: 'review_index',
      explanation: 'Precision is critically low. Check if retrieval index is up-to-date or if queries are too complex.',
      priority: 'high'
    };
  }

  if (recall_at_k < 0.4) {
    return {
      config_name: evalRun.config_name,
      recommendation_type: 'increase_top_k',
      explanation: 'Recall is low. Consider retrieving more documents (increase top_k) to capture more relevant results.',
      priority: 'high'
    };
  }

  if (precision_at_k > 0.8 && recall_at_k > 0.7 && mean_latency_ms < 500) {
    return {
      config_name: evalRun.config_name,
      recommendation_type: 'none',
      explanation: 'Retrieval performance is excellent. No tuning needed.',
      priority: 'low'
    };
  }

  if (ndcg < 0.6 && precision_at_k > 0.6) {
    return {
      config_name: evalRun.config_name,
      recommendation_type: 'enable_rerank',
      explanation: 'Results are present but not well-ranked. Enabling reranking may improve NDCG.',
      priority: 'medium'
    };
  }

  return {
    config_name: evalRun.config_name,
    recommendation_type: 'adjust_threshold',
    explanation: 'Mixed performance. Review score thresholds and adjust based on use case priorities.',
    priority: 'medium'
  };
}
