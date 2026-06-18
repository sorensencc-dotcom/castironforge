/**
 * Balanced Exclusion Profile Auto-Detecting Engine
 *
 * Fingerprints the workspace and selects the appropriate exclusion profile
 * deterministically and idempotently for CIC and autonomous agents.
 *
 * Profiles supported:
 * - fullstack: JS/TS fullstack (React, Next.js, Vue, Angular)
 * - python: Python/data engineering (FastAPI, Django, Jupyter, ML)
 * - monorepo: Monorepo (Turborepo, Lerna, Nx, pnpm workspaces)
 * - ml: Machine learning workspace (PyTorch, TensorFlow, wandb)
 * - balanced: Default balanced profile (all languages)
 */

import fs from "fs";
import path from "path";

export interface ExclusionProfile {
  name: "fullstack" | "python" | "monorepo" | "ml" | "balanced";
  description: string;
  exclude: string[];
  include: string[];
  fileSizeCapKB: number;
  languageWhitelist: string[];
}

export interface WorkspaceFingerprint {
  hasPackageJson: boolean;
  hasTsconfig: boolean;
  hasNextConfig: boolean;
  hasRequirements: boolean;
  hasPyproject: boolean;
  hasNotebooks: boolean;
  hasPackagesDir: boolean;
  hasAppsDir: boolean;
  hasTurboJson: boolean;
  hasLernaJson: boolean;
  hasNxJson: boolean;
  hasCheckpoints: boolean;
  hasWandb: boolean;
  hasPytorchWeights: boolean;
}

export class ExclusionProfileEngine {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Detect the workspace profile by fingerprinting key markers.
   * Returns the profile name based on deterministic priority ordering.
   */
  detect(): "fullstack" | "python" | "monorepo" | "ml" | "balanced" {
    const fingerprint = this.fingerprint();

    // 1. Monorepo detection (highest priority for structural patterns)
    if (
      fingerprint.hasPackagesDir ||
      fingerprint.hasAppsDir ||
      fingerprint.hasTurboJson ||
      fingerprint.hasLernaJson ||
      fingerprint.hasNxJson
    ) {
      return "monorepo";
    }

    // 2. ML workspace detection (distinct artifact patterns)
    if (
      fingerprint.hasCheckpoints ||
      fingerprint.hasWandb ||
      fingerprint.hasPytorchWeights
    ) {
      return "ml";
    }

    // 3. Python/Data engineering detection
    if (
      fingerprint.hasRequirements ||
      fingerprint.hasPyproject ||
      fingerprint.hasNotebooks
    ) {
      return "python";
    }

    // 4. JS/TS Fullstack detection
    if (
      fingerprint.hasPackageJson ||
      fingerprint.hasTsconfig ||
      fingerprint.hasNextConfig
    ) {
      return "fullstack";
    }

    // 5. Default to balanced
    return "balanced";
  }

  /**
   * Fingerprint the workspace by checking for key marker files/directories.
   * Returns a boolean object indicating presence of each marker.
   */
  private fingerprint(): WorkspaceFingerprint {
    return {
      hasPackageJson: this.exists("package.json"),
      hasTsconfig: this.exists("tsconfig.json"),
      hasNextConfig:
        this.exists("next.config.js") ||
        this.exists("next.config.ts") ||
        this.exists("next.config.mjs"),
      hasRequirements: this.exists("requirements.txt"),
      hasPyproject:
        this.exists("pyproject.toml") || this.exists("setup.py"),
      hasNotebooks: this.globExists("**/*.ipynb", 5),
      hasPackagesDir: this.exists("packages"),
      hasAppsDir: this.exists("apps"),
      hasTurboJson: this.exists("turbo.json"),
      hasLernaJson: this.exists("lerna.json"),
      hasNxJson: this.exists("nx.json"),
      hasCheckpoints:
        this.exists("checkpoints") || this.exists("model_checkpoints"),
      hasWandb: this.exists("wandb"),
      hasPytorchWeights: this.globExists("**/*.pt", 5),
    };
  }

  /**
   * Check if a file or directory exists at the given path.
   */
  private exists(filePath: string): boolean {
    try {
      fs.statSync(path.join(this.rootDir, filePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Quick glob check: return true if any file matches pattern within depth.
   * Used for expensive checks like notebook detection.
   */
  private globExists(pattern: string, maxDepth: number): boolean {
    // Simple depth-limited check without requiring glob library
    if (maxDepth === 0) return false;

    const parts = pattern.split("/");
    if (parts.length === 0) return false;

    // For patterns like **/*.ipynb, check for .ipynb files in first few levels
    if (pattern.includes("**/*.ipynb")) {
      return (
        this.hasFilesWithExt(".ipynb", maxDepth) ||
        this.exists(".ipynb_checkpoints")
      );
    }

    if (pattern.includes("**/*.pt")) {
      return this.hasFilesWithExt(".pt", maxDepth);
    }

    return false;
  }

  /**
   * Check for files with a given extension up to a certain depth.
   */
  private hasFilesWithExt(ext: string, maxDepth: number): boolean {
    if (maxDepth === 0) return false;

    try {
      const entries = fs.readdirSync(path.join(this.rootDir), {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.name.endsWith(ext)) return true;
        if (entry.isDirectory() && maxDepth > 1) {
          // Shallow recursion check
          try {
            const subEntries = fs.readdirSync(
              path.join(this.rootDir, entry.name)
            );
            for (const subEntry of subEntries) {
              if (subEntry.endsWith(ext)) return true;
            }
          } catch {
            // Ignore permission errors, etc.
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return false;
  }

  /**
   * Load the appropriate profile based on detected workspace type.
   */
  loadProfile(): ExclusionProfile {
    const profileName = this.detect();
    return this.getProfileByName(profileName);
  }

  /**
   * Get a profile by its name. Can be used independently of auto-detection.
   */
  getProfileByName(
    name: "fullstack" | "python" | "monorepo" | "ml" | "balanced"
  ): ExclusionProfile {
    const profiles = this.getAllProfiles();
    const profile = profiles[name];
    if (!profile) {
      throw new Error(`Unknown profile: ${name}`);
    }
    return profile;
  }

  /**
   * Generate CIC-ready exclusion spec from the detected profile.
   */
  generateCicSpec(): {
    version: string;
    strategy: string;
    detectedProfile: string;
    layers: Record<string, { exclude: string[]; include: string[] }>;
    fileSizeCapKB: number;
    languageWhitelist: string[];
  } {
    const profile = this.loadProfile();
    return {
      version: "1.0.0",
      strategy: profile.name,
      detectedProfile: profile.name,
      layers: {
        dependencies: {
          exclude: [
            "node_modules/",
            "vendor/",
            ".venv/",
            ".pnpm-store/",
            "__pycache__/",
            ".mypy_cache/",
          ],
          include: [
            "package.json",
            "package-lock.json",
            "requirements.txt",
            "pyproject.toml",
          ],
        },
        buildArtifacts: {
          exclude: [
            "dist/",
            "build/",
            "out/",
            ".next/",
            ".nuxt/",
            ".svelte-kit/",
            "coverage/",
            "*.tsbuildinfo",
          ],
          include: [
            "tsconfig.json",
            "next.config.js",
            "vite.config.ts",
          ],
        },
        secrets: {
          exclude: [
            ".env",
            ".env.*",
            "*.pem",
            "*.key",
            "secrets/*.json",
            "config/*.private.*",
          ],
          include: [
            ".env.example",
            "config/schema.json",
            "config/routes.json",
          ],
        },
        binary: {
          exclude: [
            "*.mp4",
            "*.mov",
            "*.zip",
            "*.tar.gz",
            "*.sqlite",
            "*.db",
            "*.parquet",
            "*.feather",
          ],
          include: [
            "assets/icons/*.svg",
            "public/*.png",
          ],
        },
        structural: {
          exclude: [
            ".git/",
            ".git/modules/",
            "*.log",
            "*.pid",
            "logs/",
            "tmp/",
            "runtime/",
          ],
          include: [],
        },
      },
      fileSizeCapKB: profile.fileSizeCapKB,
      languageWhitelist: profile.languageWhitelist,
    };
  }

  /**
   * Return all available profiles with their exclusion rules.
   */
  getAllProfiles(): Record<string, ExclusionProfile> {
    const balanced: ExclusionProfile = {
      name: "balanced",
      description:
        "Default balanced profile for all language types. Excludes token bloat and secrets while preserving architectural signals.",
      exclude: [
        "node_modules/",
        "vendor/",
        ".venv/",
        ".pnpm-store/",
        "__pycache__/",
        ".mypy_cache/",
        "dist/",
        "build/",
        "out/",
        ".next/",
        ".nuxt/",
        ".svelte-kit/",
        "coverage/",
        "*.tsbuildinfo",
        ".env",
        ".env.*",
        "*.pem",
        "*.key",
        "secrets/",
        "*.mp4",
        "*.mov",
        "*.zip",
        "*.tar.gz",
        "*.sqlite",
        "*.db",
        "*.log",
        "*.pid",
        "logs/",
        "tmp/",
        "runtime/",
        ".git/",
        ".git/modules/",
      ],
      include: [
        "package.json",
        "package-lock.json",
        "requirements.txt",
        "pyproject.toml",
        "tsconfig.json",
        "next.config.js",
        "vite.config.ts",
        ".env.example",
        "config/schema.json",
        "config/routes.json",
        "assets/icons/*.svg",
        "public/*.png",
      ],
      fileSizeCapKB: 500,
      languageWhitelist: [
        "ts",
        "js",
        "py",
        "go",
        "rs",
        "java",
        "json",
        "yaml",
        "toml",
        "md",
        "txt",
      ],
    };

    const fullstack: ExclusionProfile = {
      name: "fullstack",
      description:
        "Optimized for JS/TS fullstack: React, Next.js, Vue, Angular, Vite, Express",
      exclude: [
        ...balanced.exclude,
        ".eslintcache",
        ".stylelintcache",
        ".parcel-cache",
        "yarn.lock",
      ],
      include: [
        ...balanced.include,
        "tsconfig.*.json",
        "next.config.ts",
        "nuxt.config.ts",
        "webpack.config.js",
        "rollup.config.js",
        "jest.config.js",
        "vitest.config.ts",
        "babel.config.js",
        "tailwind.config.js",
      ],
      fileSizeCapKB: 500,
      languageWhitelist: [...balanced.languageWhitelist, "vue", "jsx", "tsx"],
    };

    const python: ExclusionProfile = {
      name: "python",
      description:
        "Optimized for Python/data: FastAPI, Django, Jupyter, pandas, scikit-learn",
      exclude: [
        ...balanced.exclude,
        ".pytest_cache/",
        "*.pyc",
        ".ipynb_checkpoints/",
        "site-packages/",
      ],
      include: [
        ...balanced.include,
        "setup.py",
        "setup.cfg",
        "Pipfile",
        "poetry.lock",
        "environment.yml",
        "requirements-dev.txt",
        "pyproject.toml",
      ],
      fileSizeCapKB: 500,
      languageWhitelist: [
        ...balanced.languageWhitelist,
        "py",
        "ipynb",
        "pyx",
      ],
    };

    const monorepo: ExclusionProfile = {
      name: "monorepo",
      description:
        "Optimized for monorepos: Turborepo, Lerna, Nx, pnpm workspaces",
      exclude: [
        ...balanced.exclude,
        ".turbo/",
        ".nx/",
        "packages/**/node_modules/",
        "apps/**/node_modules/",
      ],
      include: [
        ...balanced.include,
        "turbo.json",
        "lerna.json",
        "nx.json",
        "pnpm-workspace.yaml",
        "packages/*/package.json",
        "apps/*/package.json",
        "packages/*/tsconfig.json",
        "apps/*/tsconfig.json",
      ],
      fileSizeCapKB: 500,
      languageWhitelist: balanced.languageWhitelist,
    };

    const ml: ExclusionProfile = {
      name: "ml",
      description:
        "Optimized for ML workspaces: PyTorch, TensorFlow, wandb, MLflow",
      exclude: [
        ...balanced.exclude,
        "checkpoints/",
        "weights/",
        "models/*.bin",
        "models/*.safetensors",
        "*.pt",
        "*.pth",
        "*.ckpt",
        "wandb/",
        "mlruns/",
        "lightning_logs/",
        ".cache/",
      ],
      include: [
        ...balanced.include,
        "models/config.json",
        "models/model_index.json",
        "checkpoints/README.md",
      ],
      fileSizeCapKB: 500,
      languageWhitelist: [...balanced.languageWhitelist, "py", "ipynb"],
    };

    return {
      balanced,
      fullstack,
      python,
      monorepo,
      ml,
    };
  }
}

// CLI usage: node exclusion-profile-engine.ts [detect|profile|spec]
if (require.main === module) {
  const engine = new ExclusionProfileEngine(process.cwd());
  const command = process.argv[2] || "detect";

  switch (command) {
    case "detect":
      console.log(engine.detect());
      break;
    case "profile":
      console.log(JSON.stringify(engine.loadProfile(), null, 2));
      break;
    case "spec":
      console.log(JSON.stringify(engine.generateCicSpec(), null, 2));
      break;
    default:
      console.error(
        "Usage: node exclusion-profile-engine.ts [detect|profile|spec]"
      );
      process.exit(1);
  }
}

export default ExclusionProfileEngine;
