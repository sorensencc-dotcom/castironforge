/**
 * RL-1: Independent Critic Model Specification
 *
 * Remediation for Gap RL-1: ReviewerAgent not specified as independent model.
 * PwC 2025 production finding: 7× accuracy improvement with independent judge model.
 *
 * This module ensures ReviewerAgent uses a different model tier than the
 * generating agent, preventing same-model blind spots in QA.
 */

export type ModelTier = 'small' | 'medium' | 'large' | 'frontier';

export interface AgentModelConfig {
  generator_model_tier: ModelTier;
  reviewer_model_tier: ModelTier;
}

/**
 * Model tier hierarchy for validation
 * A reviewer must be DIFFERENT from the generator
 */
const MODEL_TIER_RANK: Record<ModelTier, number> = {
  small: 1,
  medium: 2,
  large: 3,
  frontier: 4
};

export function validateReviewerModelTier(config: AgentModelConfig): { valid: boolean; error?: string } {
  if (config.generator_model_tier === config.reviewer_model_tier) {
    return {
      valid: false,
      error: `Reviewer model tier must differ from generator. Got: ${config.generator_model_tier} for both. ` +
             `Choose a different tier (small/medium/large/frontier) for the reviewer to enable independent critique. ` +
             `Recommended: use a smaller/faster tier for reviewer (e.g., haiku reviewing opus).`
    };
  }

  // Validate that both tiers are valid
  if (!MODEL_TIER_RANK[config.generator_model_tier]) {
    return { valid: false, error: `Invalid generator_model_tier: ${config.generator_model_tier}` };
  }

  if (!MODEL_TIER_RANK[config.reviewer_model_tier]) {
    return { valid: false, error: `Invalid reviewer_model_tier: ${config.reviewer_model_tier}` };
  }

  return { valid: true };
}

/**
 * Get recommended reviewer tier for a given generator tier
 * Preference: use smaller/faster tier as reviewer for cost efficiency
 */
export function getRecommendedReviewerTier(generatorTier: ModelTier): ModelTier {
  const recommendations: Record<ModelTier, ModelTier> = {
    frontier: 'large',
    large: 'medium',
    medium: 'small',
    small: 'medium' // Can't go smaller; recommend different tier
  };

  return recommendations[generatorTier];
}

/**
 * Model tier descriptions for documentation
 */
export const MODEL_TIER_DESCRIPTIONS: Record<ModelTier, string> = {
  small: 'Fast, cost-efficient model (e.g., claude-haiku-4-5). Good for critic/reviewer roles.',
  medium: 'Balanced speed and capability (e.g., claude-sonnet-4-6). Suitable for general tasks.',
  large: 'Capable, slower model (e.g., claude-opus-4-8). Use for complex generation tasks.',
  frontier: 'Latest, most capable model. Use for critical, high-stakes generation only.'
};

/**
 * Configuration schema extension for v1.1 agent specs
 *
 * Example agent configuration with independent critic model:
 *
 * ```yaml
 * agents:
 *   - id: research_agent
 *     model: claude-opus-4-8          # Generator
 *     generator_model_tier: large     # NEW: explicit tier
 *     reviewer_model_tier: medium     # NEW: different tier for critic
 *     has_reviewer: true
 *     tools: [search, retrieval]
 * ```
 *
 * Validation happens at agent initialization time.
 * If reviewer_model_tier is not specified, defaults to a smaller tier than generator.
 * If both tiers are identical, throws validation error at startup.
 */
export function getDefaultReviewerConfig(generatorTier: ModelTier): { reviewer_model_tier: ModelTier } {
  return {
    reviewer_model_tier: getRecommendedReviewerTier(generatorTier)
  };
}
