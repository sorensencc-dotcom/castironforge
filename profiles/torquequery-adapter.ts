/**
 * TorqueQuery Exclusion Adapter
 *
 * Converts balanced exclusion profiles into TorqueQuery-compatible filter rules
 * for CIC Phase 26 ingestion pipelines.
 *
 * Responsibilities:
 * - Convert exclusion patterns → TorqueQuery filter rules
 * - Apply file-size caps
 * - Apply language whitelist
 * - Apply negation rules last (includes override excludes)
 * - Emit deterministic, reproducible filter sets
 */

import { ExclusionProfile } from "./exclusion-profile-engine";

export interface TorqueQueryFilter {
  id: string;
  type:
    | "exclude"
    | "include"
    | "sizeCap"
    | "languageWhitelist"
    | "negation";
  pattern?: string;
  maxKB?: number;
  extensions?: string[];
  priority: number;
  reason: string;
}

export interface TorqueQueryConfig {
  version: string;
  profileName: string;
  filters: TorqueQueryFilter[];
  metadata: {
    generatedAt: string;
    source: string;
    applicableToPhases: string[];
  };
}

export class TorqueQueryAdapter {
  private profile: ExclusionProfile;

  constructor(profile: ExclusionProfile) {
    this.profile = profile;
  }

  /**
   * Build TorqueQuery filters from the exclusion profile.
   *
   * Order of application:
   * 1. Excludes (lowest priority)
   * 2. Language whitelist
   * 3. Size caps
   * 4. Includes/Negations (highest priority - can override excludes)
   */
  buildFilters(): TorqueQueryFilter[] {
    const filters: TorqueQueryFilter[] = [];
    let priorityCounter = 0;

    // Layer 1: Exclude patterns (lowest priority)
    for (const pattern of this.profile.exclude) {
      filters.push({
        id: `exclude_${priorityCounter}`,
        type: "exclude",
        pattern,
        priority: priorityCounter,
        reason: `Excluded by ${this.profile.name} profile`,
      });
      priorityCounter++;
    }

    // Layer 2: Language whitelist (medium priority)
    filters.push({
      id: "language_whitelist",
      type: "languageWhitelist",
      extensions: this.profile.languageWhitelist,
      priority: priorityCounter++,
      reason: "Language filtering for source files",
    });

    // Layer 3: Size cap (medium priority)
    filters.push({
      id: "size_cap",
      type: "sizeCap",
      maxKB: this.profile.fileSizeCapKB,
      priority: priorityCounter++,
      reason: "Prevent token bloat from large files",
    });

    // Layer 4: Include/Negation patterns (highest priority - can override)
    for (const pattern of this.profile.include) {
      filters.push({
        id: `include_${priorityCounter}`,
        type: "negation",
        pattern,
        priority: priorityCounter++,
        reason: `Negation rule: always include ${pattern}`,
      });
    }

    return filters;
  }

  /**
   * Generate complete TorqueQuery configuration.
   */
  generateConfig(): TorqueQueryConfig {
    return {
      version: "1.0.0",
      profileName: this.profile.name,
      filters: this.buildFilters(),
      metadata: {
        generatedAt: new Date().toISOString(),
        source: "TorqueQueryAdapter",
        applicableToPhases: [
          "dependency_resolution",
          "configuration_analysis",
          "source_code_indexing",
          "semantic_analysis",
        ],
      },
    };
  }

  /**
   * Convert filters to TorqueQuery DSL (pseudo-code for actual TQ API).
   */
  toTorqueQueryDSL(): string {
    const filters = this.buildFilters();
    const lines: string[] = [
      `# TorqueQuery Exclusion Config (Profile: ${this.profile.name})`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      "filters:",
    ];

    for (const filter of filters) {
      switch (filter.type) {
        case "exclude":
          lines.push(`  - type: exclude`);
          lines.push(`    pattern: "${filter.pattern}"`);
          lines.push(`    reason: "${filter.reason}"`);
          break;

        case "negation":
          lines.push(`  - type: include`);
          lines.push(`    pattern: "${filter.pattern}"`);
          lines.push(`    override_excludes: true`);
          lines.push(`    reason: "${filter.reason}"`);
          break;

        case "languageWhitelist":
          lines.push(`  - type: language_whitelist`);
          lines.push(`    extensions: [${filter.extensions?.map((e) => `"${e}"`).join(", ")}]`);
          lines.push(`    reason: "${filter.reason}"`);
          break;

        case "sizeCap":
          lines.push(`  - type: size_cap`);
          lines.push(`    max_kb: ${filter.maxKB}`);
          lines.push(`    reason: "${filter.reason}"`);
          break;
      }
    }

    return lines.join("\n");
  }

  /**
   * Convert to TorqueQuery JSON API format.
   */
  toTorqueQueryJSON(): object {
    const config = this.generateConfig();
    return {
      ingestion: {
        mode: "balanced",
        profile: this.profile.name,
        filters: {
          exclude: config.filters
            .filter((f) => f.type === "exclude")
            .map((f) => f.pattern),
          include: config.filters
            .filter((f) => f.type === "negation")
            .map((f) => f.pattern),
          language_whitelist: config.filters
            .find((f) => f.type === "languageWhitelist")?.extensions || [],
          size_cap_kb:
            config.filters.find((f) => f.type === "sizeCap")?.maxKB || 500,
        },
        metadata: config.metadata,
      },
    };
  }

  /**
   * Validate filter consistency (e.g., no contradictions).
   */
  validate(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const excludeSet = new Set(this.profile.exclude);
    const includeSet = new Set(this.profile.include);

    // Check for direct contradictions
    for (const inc of includeSet) {
      for (const exc of excludeSet) {
        if (inc === exc) {
          errors.push(
            `Contradiction: "${inc}" is both excluded and included`
          );
        }
      }
    }

    // Warn if no includes present (all excludes, no negations)
    if (this.profile.include.length === 0) {
      warnings.push("No include/negation rules present; verify intentional");
    }

    // Warn if file size cap is too permissive
    if (this.profile.fileSizeCapKB > 1000) {
      warnings.push(
        `File size cap (${this.profile.fileSizeCapKB}KB) is very permissive; may cause token bloat`
      );
    }

    // Warn if too few extensions in whitelist
    if (this.profile.languageWhitelist.length < 5) {
      warnings.push(
        `Language whitelist is narrow (${this.profile.languageWhitelist.length} extensions); may exclude important formats`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate test cases for TorqueQuery integration.
   */
  generateTestCases(): Array<{
    name: string;
    input: string;
    expectedResult: "include" | "exclude";
    reason: string;
  }> {
    const testCases: Array<{
      name: string;
      input: string;
      expectedResult: "include" | "exclude";
      reason: string;
    }> = [];

    // Test excludes
    for (const pattern of this.profile.exclude.slice(0, 3)) {
      testCases.push({
        name: `Exclude pattern: ${pattern}`,
        input: `path/to/${pattern.replace(/\/$/, "")}/file.js`,
        expectedResult: "exclude",
        reason: `Matches exclude pattern: ${pattern}`,
      });
    }

    // Test includes
    for (const pattern of this.profile.include.slice(0, 3)) {
      testCases.push({
        name: `Include pattern: ${pattern}`,
        input: pattern.replace(/\*\*/g, "file"),
        expectedResult: "include",
        reason: `Matches include pattern: ${pattern}`,
      });
    }

    // Test file size cap
    testCases.push({
      name: "File size cap",
      input: "large_file.bin",
      expectedResult: "exclude",
      reason: `File exceeds size cap of ${this.profile.fileSizeCapKB}KB`,
    });

    // Test language whitelist
    if (this.profile.languageWhitelist.length > 0) {
      const [firstExt] = this.profile.languageWhitelist;
      testCases.push({
        name: `Language whitelist: .${firstExt}`,
        input: `src/file.${firstExt}`,
        expectedResult: "include",
        reason: `File extension .${firstExt} is whitelisted`,
      });
    }

    // Test non-whitelisted extension
    testCases.push({
      name: "Non-whitelisted extension",
      input: "docs/file.pdf",
      expectedResult: "exclude",
      reason: "File extension .pdf not in language whitelist",
    });

    return testCases;
  }
}

export default TorqueQueryAdapter;

// CLI export helper
export function createAdapter(profile: ExclusionProfile): TorqueQueryAdapter {
  return new TorqueQueryAdapter(profile);
}
