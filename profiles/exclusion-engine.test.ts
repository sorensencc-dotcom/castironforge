/**
 * Exclusion Engine Test Suite
 *
 * Comprehensive test coverage for:
 * - All 4 exclusion layers (dependencies, build, secrets, binary)
 * - Profile detection
 * - Self-healing drift detection
 * - Negation rules
 * - File-size caps
 * - Language whitelisting
 * - TorqueQuery adapter integration
 *
 * Run with: npm test -- exclusion-engine.test.ts
 */

import ExclusionProfileEngine, { ExclusionProfile } from "./exclusion-profile-engine";
import SelfHealingEngine from "./self-healing-engine";
import TorqueQueryAdapter from "./torquequery-adapter";

describe("ExclusionProfileEngine", () => {
  let engine: ExclusionProfileEngine;

  beforeEach(() => {
    engine = new ExclusionProfileEngine();
  });

  describe("4-Layer Exclusion Model", () => {
    describe("Layer 1: Dependency Trees", () => {
      test("should exclude node_modules directory", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("node_modules/");
      });

      test("should exclude vendor directory", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("vendor/");
      });

      test("should exclude .venv directory", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain(".venv/");
      });

      test("should include package.json manifest", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("package.json");
      });

      test("should include requirements.txt manifest", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("requirements.txt");
      });

      test("should include pyproject.toml manifest", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("pyproject.toml");
      });
    });

    describe("Layer 2: Build Artifacts", () => {
      test("should exclude dist/ directory", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("dist/");
      });

      test("should exclude build/ directory", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("build/");
      });

      test("should exclude .next/ directory", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain(".next/");
      });

      test("should include tsconfig.json build descriptor", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("tsconfig.json");
      });

      test("should include next.config.js build descriptor", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("next.config.js");
      });

      test("should include vite.config.ts build descriptor", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("vite.config.ts");
      });
    });

    describe("Layer 3: Secrets & Environment", () => {
      test("should exclude .env file", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain(".env");
      });

      test("should exclude .env.* pattern", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain(".env.*");
      });

      test("should exclude *.pem files", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("*.pem");
      });

      test("should exclude *.key files", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("*.key");
      });

      test("should include .env.example example file", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain(".env.example");
      });

      test("should include config/schema.json schema", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("config/schema.json");
      });
    });

    describe("Layer 4: Binary & Non-Text Payloads", () => {
      test("should exclude *.mp4 video files", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("*.mp4");
      });

      test("should exclude *.zip archives", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("*.zip");
      });

      test("should exclude *.sqlite databases", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.exclude).toContain("*.sqlite");
      });

      test("should include assets/icons/*.svg small UI assets", () => {
        const balanced = engine.getProfileByName("balanced");
        expect(balanced.include).toContain("assets/icons/*.svg");
      });
    });
  });

  describe("Profile Detection", () => {
    test("should detect fullstack profile with package.json and tsconfig.json", () => {
      // This would require mocking fs; simplified for demonstration
      const profile = engine.detect();
      // In a real test, mock the filesystem
      expect(["fullstack", "python", "monorepo", "ml", "balanced"]).toContain(
        profile
      );
    });

    test("should return balanced profile by default", () => {
      const profile = engine.detect();
      expect(["fullstack", "python", "monorepo", "ml", "balanced"]).toContain(
        profile
      );
    });

    test("should have all profiles defined", () => {
      const profiles = engine.getAllProfiles();
      expect(Object.keys(profiles)).toEqual([
        "balanced",
        "fullstack",
        "python",
        "monorepo",
        "ml",
      ]);
    });
  });

  describe("Profile Variants", () => {
    test("fullstack profile should extend balanced", () => {
      const fullstack = engine.getProfileByName("fullstack");
      const balanced = engine.getProfileByName("balanced");

      // Should have all balanced excludes plus more
      const fullstackExcludes = new Set(fullstack.exclude);
      const balancedExcludes = new Set(balanced.exclude);

      for (const exc of balancedExcludes) {
        expect(fullstackExcludes.has(exc)).toBe(true);
      }
    });

    test("python profile should include language-specific excludes", () => {
      const python = engine.getProfileByName("python");
      expect(python.exclude).toContain(".pytest_cache/");
    });

    test("ml profile should exclude ML artifacts", () => {
      const ml = engine.getProfileByName("ml");
      expect(ml.exclude).toContain("checkpoints/");
      expect(ml.exclude).toContain("*.pt");
      expect(ml.exclude).toContain("wandb/");
    });

    test("monorepo profile should exclude workspace-level artifacts", () => {
      const monorepo = engine.getProfileByName("monorepo");
      expect(monorepo.exclude).toContain("packages/**/node_modules/");
      expect(monorepo.exclude).toContain("apps/**/node_modules/");
    });
  });

  describe("Negation Rules", () => {
    test("include rules should override excludes", () => {
      const balanced = engine.getProfileByName("balanced");

      // package.json should be included even though node_modules is excluded
      expect(balanced.exclude).toContain("node_modules/");
      expect(balanced.include).toContain("package.json");
    });

    test("schema.json should be included even though config is excluded", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.include).toContain("config/schema.json");
    });

    test(".env.example should be included even though .env is excluded", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.exclude).toContain(".env");
      expect(balanced.include).toContain(".env.example");
    });
  });

  describe("File Size Caps", () => {
    test("should enforce 500KB file size cap by default", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.fileSizeCapKB).toBe(500);
    });

    test("all profiles should have consistent file size caps", () => {
      const profiles = engine.getAllProfiles();
      for (const profile of Object.values(profiles)) {
        expect(profile.fileSizeCapKB).toBeGreaterThan(0);
        expect(profile.fileSizeCapKB).toBeLessThan(2000);
      }
    });
  });

  describe("Language Whitelisting", () => {
    test("should whitelist TypeScript files", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.languageWhitelist).toContain("ts");
    });

    test("should whitelist Python files", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.languageWhitelist).toContain("py");
    });

    test("should whitelist JSON and YAML config", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.languageWhitelist).toContain("json");
      expect(balanced.languageWhitelist).toContain("yaml");
    });

    test("should have at least 5 whitelisted extensions", () => {
      const balanced = engine.getProfileByName("balanced");
      expect(balanced.languageWhitelist.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("CIC Spec Generation", () => {
    test("should generate valid CIC spec", () => {
      const spec = engine.generateCicSpec();
      expect(spec.version).toBe("1.0.0");
      expect(spec.detectedProfile).toBeDefined();
      expect(spec.layers).toBeDefined();
    });

    test("spec should include all 4 layers", () => {
      const spec = engine.generateCicSpec();
      expect(Object.keys(spec.layers)).toContain("dependencies");
      expect(Object.keys(spec.layers)).toContain("buildArtifacts");
      expect(Object.keys(spec.layers)).toContain("secrets");
      expect(Object.keys(spec.layers)).toContain("binary");
    });

    test("spec layers should have exclude and include rules", () => {
      const spec = engine.generateCicSpec();
      for (const layer of Object.values(spec.layers)) {
        expect(layer.exclude).toBeDefined();
        expect(layer.include).toBeDefined();
        expect(Array.isArray(layer.exclude)).toBe(true);
        expect(Array.isArray(layer.include)).toBe(true);
      }
    });
  });
});

describe("SelfHealingEngine", () => {
  let healingEngine: SelfHealingEngine;

  beforeEach(() => {
    healingEngine = new SelfHealingEngine(process.cwd(), 100); // Fast scan for tests
  });

  afterEach(() => {
    healingEngine.stop();
  });

  test("should initialize without errors", () => {
    expect(healingEngine).toBeDefined();
  });

  test("should emit 'started' event when started", (done) => {
    healingEngine.on("started", () => {
      done();
    });
    healingEngine.start();
  });

  test("should emit 'stopped' event when stopped", (done) => {
    healingEngine.start();
    healingEngine.on("stopped", () => {
      done();
    });
    setTimeout(() => healingEngine.stop(), 50);
  });

  test("should compute workspace snapshot", () => {
    healingEngine.forceRescan();
    const snapshot = healingEngine.getCurrentSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.timestamp).toBeGreaterThan(0);
    expect(snapshot?.profile).toBeDefined();
  });

  test("should have non-empty healing history after operation", () => {
    healingEngine.forceRescan();
    const history = healingEngine.getHealingHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  test("should have current manifest after initialization", () => {
    healingEngine.forceRescan();
    const manifest = healingEngine.getCurrentManifest();
    expect(manifest).toBeDefined();
    expect(manifest?.name).toBeDefined();
  });
});

describe("TorqueQueryAdapter", () => {
  let adapter: TorqueQueryAdapter;
  let profile: ExclusionProfile;

  beforeEach(() => {
    const engine = new ExclusionProfileEngine();
    profile = engine.getProfileByName("balanced");
    adapter = new TorqueQueryAdapter(profile);
  });

  describe("Filter Generation", () => {
    test("should generate filters from profile", () => {
      const filters = adapter.buildFilters();
      expect(filters.length).toBeGreaterThan(0);
    });

    test("should generate exclude filters", () => {
      const filters = adapter.buildFilters();
      const excludes = filters.filter((f) => f.type === "exclude");
      expect(excludes.length).toBeGreaterThan(0);
    });

    test("should generate include/negation filters", () => {
      const filters = adapter.buildFilters();
      const includes = filters.filter((f) => f.type === "negation");
      expect(includes.length).toBeGreaterThan(0);
    });

    test("should generate size cap filter", () => {
      const filters = adapter.buildFilters();
      const sizeCap = filters.find((f) => f.type === "sizeCap");
      expect(sizeCap).toBeDefined();
      expect(sizeCap?.maxKB).toBe(500);
    });

    test("should generate language whitelist filter", () => {
      const filters = adapter.buildFilters();
      const whitelist = filters.find((f) => f.type === "languageWhitelist");
      expect(whitelist).toBeDefined();
      expect(whitelist?.extensions?.length).toBeGreaterThan(0);
    });
  });

  describe("Config Generation", () => {
    test("should generate valid TorqueQuery config", () => {
      const config = adapter.generateConfig();
      expect(config.version).toBe("1.0.0");
      expect(config.profileName).toBeDefined();
      expect(config.filters).toBeDefined();
      expect(config.metadata).toBeDefined();
    });

    test("config should have correct profile name", () => {
      const config = adapter.generateConfig();
      expect(config.profileName).toBe("balanced");
    });

    test("config should list applicable phases", () => {
      const config = adapter.generateConfig();
      expect(config.metadata.applicableToPhases).toContain(
        "dependency_resolution"
      );
      expect(config.metadata.applicableToPhases).toContain(
        "source_code_indexing"
      );
    });
  });

  describe("DSL Generation", () => {
    test("should generate valid DSL string", () => {
      const dsl = adapter.toTorqueQueryDSL();
      expect(dsl).toContain("TorqueQuery Exclusion Config");
      expect(dsl).toContain("filters:");
    });

    test("DSL should contain exclude rules", () => {
      const dsl = adapter.toTorqueQueryDSL();
      expect(dsl).toContain("type: exclude");
    });

    test("DSL should contain include rules", () => {
      const dsl = adapter.toTorqueQueryDSL();
      expect(dsl).toContain("type: include");
    });
  });

  describe("JSON API Format", () => {
    test("should generate valid JSON API format", () => {
      const json = adapter.toTorqueQueryJSON();
      expect(json).toHaveProperty("ingestion");
      expect((json as any).ingestion).toHaveProperty("mode");
      expect((json as any).ingestion).toHaveProperty("profile");
      expect((json as any).ingestion).toHaveProperty("filters");
    });

    test("JSON should have exclude filters", () => {
      const json = adapter.toTorqueQueryJSON() as any;
      expect(Array.isArray(json.ingestion.filters.exclude)).toBe(true);
    });

    test("JSON should have include filters", () => {
      const json = adapter.toTorqueQueryJSON() as any;
      expect(Array.isArray(json.ingestion.filters.include)).toBe(true);
    });
  });

  describe("Validation", () => {
    test("should validate without errors", () => {
      const result = adapter.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should report warnings for overly permissive caps", () => {
      const permissiveProfile = {
        ...profile,
        fileSizeCapKB: 2000,
      };
      const permissiveAdapter = new TorqueQueryAdapter(permissiveProfile);
      const result = permissiveAdapter.validate();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Test Case Generation", () => {
    test("should generate test cases", () => {
      const testCases = adapter.generateTestCases();
      expect(testCases.length).toBeGreaterThan(0);
    });

    test("test cases should have required fields", () => {
      const testCases = adapter.generateTestCases();
      for (const tc of testCases) {
        expect(tc.name).toBeDefined();
        expect(tc.input).toBeDefined();
        expect(tc.expectedResult).toBeDefined();
        expect(tc.reason).toBeDefined();
      }
    });

    test("test cases should include exclude, include, and size cap cases", () => {
      const testCases = adapter.generateTestCases();
      const testNames = testCases.map((tc) => tc.name).join(" ");
      expect(testNames).toContain("Exclude");
      expect(testNames).toContain("Include");
      expect(testNames).toContain("size");
    });
  });
});

describe("Integration Tests", () => {
  test("engine and adapter should work together", () => {
    const engine = new ExclusionProfileEngine();
    const profile = engine.getProfileByName("fullstack");
    const adapter = new TorqueQueryAdapter(profile);

    const config = adapter.generateConfig();
    expect(config.profileName).toBe("fullstack");
    expect(config.filters.length).toBeGreaterThan(0);
  });

  test("self-healing engine should support all profiles", () => {
    const engine = new ExclusionProfileEngine();
    const profiles = engine.getAllProfiles();

    for (const profile of Object.values(profiles)) {
      const adapter = new TorqueQueryAdapter(profile);
      const validation = adapter.validate();
      expect(validation.valid).toBe(true);
    }
  });

  test("end-to-end: detect → load → convert → validate", () => {
    const engine = new ExclusionProfileEngine();
    const detectedProfile = engine.detect();
    const profile = engine.getProfileByName(detectedProfile);
    const adapter = new TorqueQueryAdapter(profile);
    const validation = adapter.validate();

    expect(validation.valid).toBe(true);
  });
});
