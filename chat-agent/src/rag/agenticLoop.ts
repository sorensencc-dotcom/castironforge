/**
 * R-1: Agentic RAG Loop Implementation
 *
 * Remediation for Gap R-1: Static pipeline only — no agentic RAG.
 * 2025–2026 production standard: agents control retrieval through
 * critique-and-reformulate cycles.
 *
 * This module implements the AgenticRetrievalLoop: query → retrieve →
 * critique → re-query if needed → max 3 hops. Enables quality-gated
 * multi-hop retrieval with automatic query reformulation.
 */

export type RetrievalStrategy = 'static' | 'agentic' | 'self_rag' | 'graph';

export interface RetrievalConfig {
  strategy: RetrievalStrategy;
  top_k: number;
  score_threshold: number;
  hybrid_search: boolean;
  rerank: boolean;
  namespace?: string;
  max_tokens_retrieved: number;
  freshness_days?: number;
}

export interface RetrievalResult {
  doc_id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface CritiqueResult {
  quality: number; // 0-1
  coverage_gaps: string[];
  suggested_reformulation?: string;
  reasoning: string;
}

export interface AgenticRetrievalHop {
  hop: number;
  query: string;
  results_count: number;
  top_score: number;
  outcome: 'ACCEPTED' | 'REFORMULATED' | 'PARTIAL';
  critique?: CritiqueResult;
}

export interface AgenticRetrievalTrace {
  initial_query: string;
  hops: AgenticRetrievalHop[];
  assembled_tokens: number;
  total_hops: number;
  final_outcome: 'SUCCESS' | 'PARTIAL' | 'DEGRADED';
  duration_ms: number;
}

/**
 * Core agentic retrieval loop implementation
 *
 * Performs iterative retrieval with critique-and-reformulation:
 * 1. Retrieve from vector store
 * 2. Critique results quality
 * 3. If quality good enough: accept and exit
 * 4. If reformulation suggested: reformulate query and retry
 * 5. If max hops exceeded: return partial results
 */
export async function agenticRetrievalLoop(
  query: string,
  config: RetrievalConfig,
  handlers: {
    retrieve: (q: string, cfg: RetrievalConfig) => Promise<RetrievalResult[]>;
    critique: (docs: RetrievalResult[], originalQuery: string) => Promise<CritiqueResult>;
    assemble: (docs: RetrievalResult[], maxTokens: number) => string;
  },
  options: {
    maxHops?: number;
    qualityThreshold?: number;
  } = {}
): Promise<{ context: string; trace: AgenticRetrievalTrace }> {
  const maxHops = options.maxHops ?? 3;
  const qualityThreshold = options.qualityThreshold ?? 0.75;

  const trace: AgenticRetrievalTrace = {
    initial_query: query,
    hops: [],
    assembled_tokens: 0,
    total_hops: 0,
    final_outcome: 'PARTIAL',
    duration_ms: 0
  };

  const startTime = Date.now();
  let currentQuery = query;
  let retrievedDocs: RetrievalResult[] = [];
  let hop = 0;

  // Main loop
  while (hop < maxHops) {
    // Step 1: Retrieve
    const results = await handlers.retrieve(currentQuery, config);

    const hopRecord: AgenticRetrievalHop = {
      hop,
      query: currentQuery,
      results_count: results.length,
      top_score: results.length > 0 ? results[0].score : 0,
      outcome: 'PARTIAL'
    };

    // Step 2: Critique
    const critique = await handlers.critique(results, query);
    hopRecord.critique = critique;

    // Step 3: Quality gate
    if (critique.quality >= qualityThreshold) {
      hopRecord.outcome = 'ACCEPTED';
      retrievedDocs.push(...results);
      trace.hops.push(hopRecord);
      trace.final_outcome = 'SUCCESS';
      break;
    }

    // Step 4: Reformulation check
    if (critique.suggested_reformulation && hop < maxHops - 1) {
      hopRecord.outcome = 'REFORMULATED';
      currentQuery = critique.suggested_reformulation;
      trace.hops.push(hopRecord);
      hop++;
    } else {
      // Step 5: Max hops or no reformulation
      hopRecord.outcome = 'PARTIAL';
      retrievedDocs.push(...results);
      trace.hops.push(hopRecord);

      if (hop === maxHops - 1) {
        trace.final_outcome = 'PARTIAL';
      } else {
        trace.final_outcome = 'DEGRADED';
      }

      break;
    }
  }

  // Assemble final context within token budget
  const assembledContext = handlers.assemble(retrievedDocs, config.max_tokens_retrieved);

  trace.total_hops = trace.hops.length;
  trace.assembled_tokens = Math.ceil(assembledContext.length / 4); // Rough estimate
  trace.duration_ms = Date.now() - startTime;

  return { context: assembledContext, trace };
}

/**
 * Determine retrieval strategy based on runtime profile and configuration
 *
 * Profile-strategy mapping:
 * - FAST        → static (single pass, no critique)
 * - BALANCED    → static (single pass with reranking)
 * - THOROUGH    → agentic (multi-hop with critique)
 * - SCHEDULED   → self_rag (agent decides whether to retrieve)
 * - SAFE        → self_rag (maximum safety/audit trail)
 */
export function getStrategyForProfile(profile: string): RetrievalStrategy {
  const profileMap: Record<string, RetrievalStrategy> = {
    FAST: 'static',
    BALANCED: 'static',
    THOROUGH: 'agentic',
    SCHEDULED: 'self_rag',
    SAFE: 'self_rag'
  };

  return profileMap[profile] ?? 'static';
}

/**
 * Self-RAG gate: agent decides whether to retrieve before invoking retrieval loop
 *
 * Example agent prompt:
 * "Do you need to retrieve information to answer this question?"
 * Response: yes/no
 *
 * If yes, invoke agenticRetrievalLoop. If no, proceed with generation.
 */
export interface SelfRAGDecision {
  should_retrieve: boolean;
  reasoning: string;
}

/**
 * Quality metrics for retrieval (RAGAS framework alignment)
 *
 * Used to compute SLO compliance and trigger retrieval eval scheduler
 */
export interface RetrievalMetrics {
  precision_at_k: number; // Fraction of top-k results relevant
  recall_at_k: number; // Coverage of relevant docs in top-k
  mrr: number; // Mean Reciprocal Rank
  ndcg: number; // Normalized Discounted Cumulative Gain
  latency_ms: number;
  hop_count: number;
  quality_degradation_pct: number; // % difference from golden set baseline
}

/**
 * Retrieval evaluation scheduler (scheduled weekly, per Gap R-4)
 *
 * Computes RAGAS metrics against held-out golden question set and
 * alerts if Precision@5 drops > 10% week-over-week.
 */
export interface RetrievalEvalResult {
  eval_id: string;
  eval_timestamp: string;
  config_name: string;
  metrics: RetrievalMetrics;
  slo_target: { precision_at_5: number };
  slo_compliance: boolean;
  alert_triggered: boolean;
  degradation_reason?: string;
}

/**
 * Agentic RAG config schema extension for v1.1
 *
 * Example retrieval configuration:
 *
 * ```yaml
 * retrieval:
 *   - name: KnowledgeBase-Technical
 *     strategy: agentic          # NEW: strategy selector
 *     index_name: technical-docs
 *     top_k: 5
 *     score_threshold: 0.4
 *     max_tokens_retrieved: 4000
 *     quality_threshold: 0.75    # NEW: for agentic loop
 *     max_hops: 3                # NEW: max reformulations
 *     rerank: true
 *     hybrid_search: true
 * ```
 *
 * For THOROUGH profile, strategy defaults to agentic.
 * For FAST/BALANCED profiles, strategy defaults to static.
 * For SAFE profile, strategy defaults to self_rag (agent gates retrieval).
 */
export interface RetrievalConfigV11 extends RetrievalConfig {
  name: string;
  quality_threshold?: number; // Default: 0.75
  max_hops?: number; // Default: 3
}
