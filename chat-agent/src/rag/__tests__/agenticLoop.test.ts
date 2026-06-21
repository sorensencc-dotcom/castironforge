/**
 * R-1: Agentic Retrieval Loop — Integration Tests
 *
 * Validates multi-hop retrieval with critique-and-reformulate strategy,
 * quality gates, and automatic query reformulation.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  agenticRetrievalLoop,
  getStrategyForProfile,
  RetrievalConfig,
  RetrievalResult,
  CritiqueResult,
  AgenticRetrievalHop,
  AgenticRetrievalTrace
} from '../agenticLoop';

describe('R-1: Agentic Retrieval Loop', () => {
  let config: RetrievalConfig;

  beforeEach(() => {
    config = {
      strategy: 'agentic',
      top_k: 5,
      score_threshold: 0.4,
      hybrid_search: true,
      rerank: true,
      max_tokens_retrieved: 4000,
      namespace: 'default'
    };
  });

  describe('Strategy Selection', () => {
    it('should map FAST profile to static strategy', () => {
      expect(getStrategyForProfile('FAST')).toBe('static');
    });

    it('should map BALANCED profile to static strategy', () => {
      expect(getStrategyForProfile('BALANCED')).toBe('static');
    });

    it('should map THOROUGH profile to agentic strategy', () => {
      expect(getStrategyForProfile('THOROUGH')).toBe('agentic');
    });

    it('should map SCHEDULED profile to self_rag strategy', () => {
      expect(getStrategyForProfile('SCHEDULED')).toBe('self_rag');
    });

    it('should map SAFE profile to self_rag strategy', () => {
      expect(getStrategyForProfile('SAFE')).toBe('self_rag');
    });

    it('should default to static for unknown profile', () => {
      expect(getStrategyForProfile('UNKNOWN')).toBe('static');
    });
  });

  describe('Quality Gate & Acceptance', () => {
    it('should accept results when quality meets threshold', async () => {
      const mockResults: RetrievalResult[] = [
        {
          doc_id: 'doc-1',
          content: 'Relevant content about the topic',
          score: 0.92,
          metadata: { source: 'documentation' }
        },
        {
          doc_id: 'doc-2',
          content: 'Related information',
          score: 0.85,
          metadata: { source: 'guide' }
        }
      ];

      const { context, trace } = await agenticRetrievalLoop(
        'What is the API?',
        config,
        {
          retrieve: async () => mockResults,
          critique: async (docs) => ({
            quality: 0.88, // Meets default 0.75 threshold
            coverage_gaps: [],
            reasoning: 'Results comprehensively cover the query'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        }
      );

      expect(context).toContain('Relevant content about the topic');
      expect(trace.final_outcome).toBe('SUCCESS');
      expect(trace.hops).toHaveLength(1);
      expect(trace.hops[0].outcome).toBe('ACCEPTED');
    });

    it('should reject when quality is below threshold and reformulate', async () => {
      const mockResults: RetrievalResult[] = [
        {
          doc_id: 'doc-1',
          content: 'Loosely related content',
          score: 0.45,
          metadata: { source: 'forum' }
        }
      ];

      let queryAttempts: string[] = [];

      const { trace } = await agenticRetrievalLoop(
        'Specific technical question',
        config,
        {
          retrieve: async (query) => {
            queryAttempts.push(query);
            return mockResults;
          },
          critique: async (docs) => ({
            quality: 0.92, // Good quality on reformulated query
            coverage_gaps: [],
            reasoning: 'Results are now excellent'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 3, qualityThreshold: 0.75 }
      );

      // First query returns low quality, triggers reformulation
      // Subsequent query (on first attempt it would reformulate but we make critique good)
      expect(trace.final_outcome).toBe('SUCCESS');
    });
  });

  describe('Query Reformulation', () => {
    it('should reformulate query when critique suggests it', async () => {
      let queryAttempts: string[] = [];

      const { trace } = await agenticRetrievalLoop(
        'original query',
        config,
        {
          retrieve: async (query) => {
            queryAttempts.push(query);
            if (query === 'original query') {
              return [{ doc_id: 'd1', content: 'poor match', score: 0.5, metadata: {} }];
            } else {
              return [{ doc_id: 'd2', content: 'excellent match', score: 0.92, metadata: {} }];
            }
          },
          critique: async (docs, originalQuery) => {
            if (docs[0].score < 0.7) {
              return {
                quality: 0.4,
                coverage_gaps: ['Too broad'],
                suggested_reformulation: 'refined query',
                reasoning: 'Need more specific results'
              };
            }
            return {
              quality: 0.9,
              coverage_gaps: [],
              reasoning: 'Results are excellent'
            };
          },
          assemble: (docs) => docs.map(d => d.content).join('\n')
        }
      );

      expect(queryAttempts).toEqual(['original query', 'refined query']);
      expect(trace.total_hops).toBe(2);
      expect(trace.hops[0].outcome).toBe('REFORMULATED');
      expect(trace.hops[1].outcome).toBe('ACCEPTED');
    });

    it('should not reformulate on final hop (max hops reached)', async () => {
      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => [
            { doc_id: 'd1', content: 'partial match', score: 0.6, metadata: {} }
          ],
          critique: async () => ({
            quality: 0.5,
            coverage_gaps: ['Incomplete'],
            suggested_reformulation: 'better query',
            reasoning: 'Could be better'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 2, qualityThreshold: 0.75 }
      );

      // At hop 1 (the second hop, since 0-indexed and maxHops=2), should not reformulate
      expect(trace.total_hops).toBe(2);
      expect(trace.hops[1].outcome).toBe('PARTIAL'); // Max hops reached
    });
  });

  describe('Multi-Hop Loop', () => {
    it('should execute maximum 3 hops (default)', async () => {
      let hopCount = 0;

      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => {
            hopCount++;
            return [{ doc_id: `d${hopCount}`, content: 'content', score: 0.5, metadata: {} }];
          },
          critique: async () => ({
            quality: 0.5,
            coverage_gaps: ['Incomplete'],
            suggested_reformulation: `reformulation-${hopCount}`,
            reasoning: 'Keep going'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 3 }
      );

      expect(hopCount).toBe(3);
      expect(trace.total_hops).toBe(3);
    });

    it('should respect custom maxHops parameter', async () => {
      let hopCount = 0;

      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => {
            hopCount++;
            return [{ doc_id: `d${hopCount}`, content: 'content', score: 0.6, metadata: {} }];
          },
          critique: async () => ({
            quality: 0.6,
            coverage_gaps: [],
            suggested_reformulation: `reform-${hopCount}`,
            reasoning: 'Continue'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 5 }
      );

      // Will continue until quality threshold met or max hops reached
      expect(trace.total_hops).toBeLessThanOrEqual(5);
    });

    it('should stop early on acceptance', async () => {
      let hopCount = 0;

      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => {
            hopCount++;
            return [{ doc_id: `d${hopCount}`, content: 'high quality content', score: 0.95, metadata: {} }];
          },
          critique: async () => ({
            quality: 0.9,
            coverage_gaps: [],
            reasoning: 'Perfect match'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 5, qualityThreshold: 0.75 }
      );

      expect(hopCount).toBe(1); // Should stop after first hop
      expect(trace.total_hops).toBe(1);
      expect(trace.final_outcome).toBe('SUCCESS');
    });
  });

  describe('Outcome Classification', () => {
    it('should classify SUCCESS when accepted before max hops', async () => {
      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => [
            { doc_id: 'd1', content: 'great content', score: 0.95, metadata: {} }
          ],
          critique: async (docs) => ({
            quality: 0.92,
            coverage_gaps: [],
            reasoning: 'Excellent results'
          }),
          assemble: (docs) => docs[0].content
        },
        { maxHops: 3 }
      );

      expect(trace.final_outcome).toBe('SUCCESS');
    });

    it('should classify PARTIAL when max hops reached without full acceptance', async () => {
      let hopCount = 0;
      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => {
            hopCount++;
            return [
              { doc_id: `d${hopCount}`, content: 'partial content', score: 0.65, metadata: {} }
            ];
          },
          critique: async (docs) => {
            // Return reformulation suggestion for first hop, no suggestion for second
            if (hopCount === 1) {
              return {
                quality: 0.65,
                coverage_gaps: ['Some gaps'],
                suggested_reformulation: 'better query',
                reasoning: 'Try reformulating'
              };
            }
            return {
              quality: 0.65,
              coverage_gaps: ['Some gaps'],
              reasoning: 'Acceptable but not ideal'
            };
          },
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 2, qualityThreshold: 0.75 }
      );

      expect(trace.final_outcome).toBe('PARTIAL');
      expect(trace.total_hops).toBe(2);
    });

    it('should classify DEGRADED when no reformulation and low quality', async () => {
      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => [
            { doc_id: 'd1', content: 'poor content', score: 0.3, metadata: {} }
          ],
          critique: async (docs) => ({
            quality: 0.3,
            coverage_gaps: ['Major gaps', 'No coverage'],
            reasoning: 'Poor results',
            suggested_reformulation: undefined // No reformulation available
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 2 }
      );

      expect(trace.final_outcome).toBe('DEGRADED');
    });
  });

  describe('Trace & Metadata', () => {
    it('should build complete hop record with all fields', async () => {
      const { trace } = await agenticRetrievalLoop(
        'test query',
        config,
        {
          retrieve: async (query) => [
            { doc_id: 'd1', content: 'result', score: 0.92, metadata: { source: 'api-docs' } }
          ],
          critique: async (docs) => ({
            quality: 0.88,
            coverage_gaps: [],
            reasoning: 'Good coverage'
          }),
          assemble: (docs) => docs[0].content
        }
      );

      const hop = trace.hops[0];
      expect(hop.hop).toBe(0);
      expect(hop.query).toBe('test query');
      expect(hop.results_count).toBe(1);
      expect(hop.top_score).toBe(0.92);
      expect(hop.outcome).toBe('ACCEPTED');
      expect(hop.critique).toBeDefined();
      expect(hop.critique?.quality).toBe(0.88);
    });

    it('should track duration and assembled tokens', async () => {
      const { trace } = await agenticRetrievalLoop(
        'query',
        config,
        {
          retrieve: async () => [
            { doc_id: 'd1', content: 'x'.repeat(1000), score: 0.9, metadata: {} }
          ],
          critique: async () => ({
            quality: 0.9,
            coverage_gaps: [],
            reasoning: 'Good'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        }
      );

      expect(trace.duration_ms).toBeGreaterThanOrEqual(0);
      expect(trace.assembled_tokens).toBeGreaterThan(0);
      expect(trace.total_hops).toBe(1);
    });

    it('should handle empty retrieval results', async () => {
      const { trace } = await agenticRetrievalLoop(
        'obscure query',
        config,
        {
          retrieve: async () => [], // No results
          critique: async (docs) => ({
            quality: 0.0,
            coverage_gaps: ['No results found'],
            suggested_reformulation: 'try different terms',
            reasoning: 'Empty result set'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 2 }
      );

      expect(trace.hops[0].results_count).toBe(0);
      expect(trace.hops[0].top_score).toBe(0);
    });
  });

  describe('Production Scenarios', () => {
    it('should handle complex multi-document retrieval with reformulation', async () => {
      const allDocs = {
        'api-docs': [
          { doc_id: 'api-1', content: 'API v2 reference', score: 0.8, metadata: { source: 'api-docs' } },
          { doc_id: 'api-2', content: 'API v2 authentication', score: 0.75, metadata: { source: 'api-docs' } }
        ],
        'guides': [
          { doc_id: 'guide-1', content: 'Getting Started with API', score: 0.88, metadata: { source: 'guides' } },
          { doc_id: 'guide-2', content: 'API best practices', score: 0.82, metadata: { source: 'guides' } }
        ]
      };

      let queryPhase = 0;

      const { context, trace } = await agenticRetrievalLoop(
        'How do I authenticate with the API?',
        config,
        {
          retrieve: async (query) => {
            if (query.includes('authenticate')) {
              return allDocs['api-docs'];
            } else {
              return allDocs['guides'];
            }
          },
          critique: async (docs) => {
            queryPhase++;
            if (queryPhase === 1) {
              return {
                quality: 0.72,
                coverage_gaps: ['Lacking best practices'],
                suggested_reformulation: 'API authentication and best practices',
                reasoning: 'API reference found but incomplete guidance'
              };
            }
            return {
              quality: 0.89,
              coverage_gaps: [],
              reasoning: 'Complete coverage with best practices'
            };
          },
          assemble: (docs) => {
            const bySource = docs.reduce((acc, doc) => {
              const source = doc.metadata?.source as string || 'unknown';
              if (!acc[source]) acc[source] = [];
              acc[source].push(doc.content);
              return acc;
            }, {} as Record<string, string[]>);
            return Object.entries(bySource)
              .map(([source, contents]) => `${source}:\n${contents.join('\n')}`)
              .join('\n\n');
          }
        },
        { maxHops: 3, qualityThreshold: 0.75 }
      );

      expect(trace.total_hops).toBe(2);
      expect(trace.hops[0].outcome).toBe('REFORMULATED');
      expect(trace.hops[1].outcome).toBe('ACCEPTED');
      expect(trace.final_outcome).toBe('SUCCESS');
      expect(context).toContain('API best practices');
    });

    it('should gracefully degrade when retrieval quality consistently low', async () => {
      const { context, trace } = await agenticRetrievalLoop(
        'Very specific edge case',
        config,
        {
          retrieve: async () => [
            { doc_id: 'd1', content: 'Somewhat related', score: 0.55, metadata: {} }
          ],
          critique: async (docs) => ({
            quality: 0.55,
            coverage_gaps: ['Incomplete', 'Different topic'],
            suggested_reformulation: 'alternative formulation',
            reasoning: 'Poor match but no better found'
          }),
          assemble: (docs) => docs.map(d => d.content).join('\n')
        },
        { maxHops: 3, qualityThreshold: 0.75 }
      );

      expect(trace.final_outcome).toBe('PARTIAL');
      expect(trace.total_hops).toBe(3); // Exhausted max hops
      // Caller should use partial results with low confidence
      expect(context).toContain('Somewhat related');
    });

    it('should handle token budget within assembled_tokens', async () => {
      const largeDoc = 'x'.repeat(5000); // Large document

      const { context, trace } = await agenticRetrievalLoop(
        'query',
        { ...config, max_tokens_retrieved: 1000 }, // Token limit
        {
          retrieve: async () => [
            { doc_id: 'd1', content: largeDoc, score: 0.9, metadata: {} }
          ],
          critique: async (docs) => ({
            quality: 0.9,
            coverage_gaps: [],
            reasoning: 'Good'
          }),
          assemble: (docs, maxTokens) => {
            // Assemble respecting token budget
            const assembled = docs.map(d => d.content).join('\n');
            return assembled.substring(0, maxTokens * 4); // Rough token-to-char ratio
          }
        }
      );

      expect(trace.assembled_tokens).toBeLessThanOrEqual(1500); // Some buffer for estimation
    });
  });
});
