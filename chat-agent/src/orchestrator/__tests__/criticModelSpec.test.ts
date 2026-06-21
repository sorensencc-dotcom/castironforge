/**
 * RL-1: Independent Critic Model Spec — Integration Tests
 *
 * Validates that ReviewerAgent uses a different model tier than generator.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateReviewerModelTier,
  getRecommendedReviewerTier,
  getDefaultReviewerConfig,
  MODEL_TIER_RANK
} from '../criticModelSpec';

describe('RL-1: Independent Critic Model Spec', () => {
  describe('validateReviewerModelTier', () => {
    it('should pass when reviewer tier differs from generator', () => {
      const config = {
        generator_model_tier: 'large' as const,
        reviewer_model_tier: 'medium' as const
      };

      const result = validateReviewerModelTier(config);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when tiers are identical', () => {
      const config = {
        generator_model_tier: 'large' as const,
        reviewer_model_tier: 'large' as const
      };

      const result = validateReviewerModelTier(config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must differ');
    });

    it('should reject invalid generator tier', () => {
      const config = {
        generator_model_tier: 'invalid' as any,
        reviewer_model_tier: 'medium' as const
      };

      const result = validateReviewerModelTier(config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid generator_model_tier');
    });

    it('should reject invalid reviewer tier', () => {
      const config = {
        generator_model_tier: 'large' as const,
        reviewer_model_tier: 'invalid' as any
      };

      const result = validateReviewerModelTier(config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid reviewer_model_tier');
    });

    it('should validate all valid tier combinations', () => {
      const tiers = ['small', 'medium', 'large', 'frontier'] as const;

      for (const gen of tiers) {
        for (const rev of tiers) {
          if (gen === rev) {
            const result = validateReviewerModelTier({
              generator_model_tier: gen,
              reviewer_model_tier: rev
            });
            expect(result.valid).toBe(false);
          } else {
            const result = validateReviewerModelTier({
              generator_model_tier: gen,
              reviewer_model_tier: rev
            });
            expect(result.valid).toBe(true);
          }
        }
      }
    });
  });

  describe('getRecommendedReviewerTier', () => {
    it('should recommend smaller tier for large generator', () => {
      expect(getRecommendedReviewerTier('large')).toBe('medium');
    });

    it('should recommend smaller tier for medium generator', () => {
      expect(getRecommendedReviewerTier('medium')).toBe('small');
    });

    it('should recommend different tier for small generator', () => {
      const rec = getRecommendedReviewerTier('small');
      expect(rec).not.toBe('small');
      expect(['small', 'medium', 'large', 'frontier']).toContain(rec);
    });

    it('should recommend large tier for frontier generator', () => {
      expect(getRecommendedReviewerTier('frontier')).toBe('large');
    });

    it('should prefer cost efficiency (smaller tier when possible)', () => {
      const recs = {
        small: getRecommendedReviewerTier('small'),
        medium: getRecommendedReviewerTier('medium'),
        large: getRecommendedReviewerTier('large'),
        frontier: getRecommendedReviewerTier('frontier')
      };

      // Verify recommendations are different
      expect(recs.large).toBe('medium'); // Cost-efficient
      expect(recs.medium).toBe('small'); // Most cost-efficient
    });
  });

  describe('getDefaultReviewerConfig', () => {
    it('should return default config with recommended tier', () => {
      const config = getDefaultReviewerConfig('large');
      expect(config.reviewer_model_tier).toBe('medium');
    });

    it('should ensure default config passes validation', () => {
      for (const genTier of ['small', 'medium', 'large', 'frontier'] as const) {
        const defaultConfig = getDefaultReviewerConfig(genTier);
        const result = validateReviewerModelTier({
          generator_model_tier: genTier,
          ...defaultConfig
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Production Scenario', () => {
    it('should enforce independent critic for research agent', () => {
      const researchAgentConfig = {
        generator_model_tier: 'opus' as any // Large model
      };

      // Get recommended critic
      const criticTier = getRecommendedReviewerTier('large');

      // Validate the pairing
      const validation = validateReviewerModelTier({
        generator_model_tier: 'large' as const,
        reviewer_model_tier: criticTier
      });

      expect(validation.valid).toBe(true);
      // Critic should be smaller/faster for cost efficiency
      expect(MODEL_TIER_RANK[criticTier]).toBeLessThan(MODEL_TIER_RANK['large']);
    });

    it('should catch misconfiguration at startup', () => {
      const misconfigured = {
        generator_model_tier: 'large' as const,
        reviewer_model_tier: 'large' as const // BUG: same tier
      };

      const result = validateReviewerModelTier(misconfigured);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must differ');
    });
  });
});
