/**
 * Self-Healing Exclusion Engine
 *
 * Continuously monitors workspace drift and automatically adjusts exclusion rules
 * without compromising the 4-layer model (dependencies, build artifacts, secrets, binary).
 *
 * Core loop:
 * - Scan workspace every N seconds
 * - Compute fingerprint (extensions, structure, frameworks, binary density)
 * - Compare against last known fingerprint
 * - If drift detected → recalc profile → merge → re-emit manifest
 */

import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import ExclusionProfileEngine, { ExclusionProfile } from "./exclusion-profile-engine";

export interface WorkspaceSnapshot {
  timestamp: number;
  fileExtensions: Map<string, number>;
  directories: Set<string>;
  binaryDensity: number;
  frameworks: string[];
  secrets: string[];
  profile: string;
}

export interface DriftDetected {
  type:
    | "framework_change"
    | "language_addition"
    | "ml_artifacts"
    | "secret_addition"
    | "binary_spike";
  description: string;
  previous: WorkspaceSnapshot;
  current: WorkspaceSnapshot;
}

export interface HealingAction {
  type: "exclude" | "include" | "profile_switch" | "size_cap_adjust";
  target: string;
  reason: string;
  timestamp: number;
}

export class SelfHealingEngine extends EventEmitter {
  private rootDir: string;
  private scanInterval: number;
  private lastSnapshot: WorkspaceSnapshot | null = null;
  private healingHistory: HealingAction[] = [];
  private scanTimer: NodeJS.Timeout | null = null;
  private profileEngine: ExclusionProfileEngine;
  private currentManifest: ExclusionProfile | null = null;

  constructor(rootDir: string = process.cwd(), scanIntervalMs: number = 5000) {
    super();
    this.rootDir = rootDir;
    this.scanInterval = scanIntervalMs;
    this.profileEngine = new ExclusionProfileEngine(rootDir);
  }

  /**
   * Start the self-healing loop.
   */
  start(): void {
    if (this.scanTimer) {
      console.warn("Self-healing engine already running");
      return;
    }

    console.log(
      `[SelfHealingEngine] Starting with scan interval: ${this.scanInterval}ms`
    );
    this.emit("started");

    // Initial scan
    this.scan();

    // Set up recurring scan
    this.scanTimer = setInterval(() => this.scan(), this.scanInterval);
  }

  /**
   * Stop the self-healing loop.
   */
  stop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
      console.log("[SelfHealingEngine] Stopped");
      this.emit("stopped");
    }
  }

  /**
   * Single scan cycle: fingerprint → drift detection → healing.
   */
  private scan(): void {
    const currentSnapshot = this.computeFingerprint();

    if (!this.lastSnapshot) {
      this.lastSnapshot = currentSnapshot;
      console.log(
        `[SelfHealingEngine] Initial snapshot: profile=${currentSnapshot.profile}`
      );
      this.emit("initialized", currentSnapshot);

      const validProfiles = ["fullstack", "python", "monorepo", "ml", "balanced"];
      if (validProfiles.includes(currentSnapshot.profile)) {
        this.currentManifest = this.profileEngine.getProfileByName(
          currentSnapshot.profile as "fullstack" | "python" | "monorepo" | "ml" | "balanced"
        );
      } else {
        console.warn(
          `[SelfHealingEngine] Invalid profile detected: ${currentSnapshot.profile}, defaulting to balanced`
        );
        this.currentManifest = this.profileEngine.getProfileByName("balanced");
      }
      return;
    }

    const drift = this.detectDrift(this.lastSnapshot, currentSnapshot);

    if (drift.length > 0) {
      console.log(`[SelfHealingEngine] Drift detected: ${drift.length} changes`);
      this.emit("drift_detected", drift);

      const healingActions = this.performHealing(drift);
      console.log(
        `[SelfHealingEngine] Healing applied: ${healingActions.length} actions`
      );
      this.emit("healed", healingActions);

      this.lastSnapshot = currentSnapshot;
    }
  }

  /**
   * Compute a full workspace fingerprint.
   */
  private computeFingerprint(): WorkspaceSnapshot {
    const fileExtensions = new Map<string, number>();
    const directories = new Set<string>();
    let totalSize = 0;
    let binarySize = 0;
    const frameworks: string[] = [];
    const secrets: string[] = [];

    const walk = (dir: string, depth: number = 0): void => {
      if (depth > 5) return; // Limit recursion depth

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(this.rootDir, fullPath);

          if (entry.isDirectory()) {
            directories.add(relPath);

            // Framework detection
            if (entry.name === "node_modules") frameworks.push("nodejs");
            if (entry.name === ".venv" || entry.name === "__pycache__")
              frameworks.push("python");
            if (entry.name === "checkpoints" || entry.name === "wandb")
              frameworks.push("ml");

            // Recurse
            walk(fullPath, depth + 1);
          } else {
            // Track extensions
            const ext = path.extname(entry.name) || "no-ext";
            fileExtensions.set(ext, (fileExtensions.get(ext) || 0) + 1);

            // Secret detection
            if (
              entry.name.startsWith(".env") ||
              entry.name.endsWith(".key") ||
              entry.name.endsWith(".pem")
            ) {
              secrets.push(relPath);
            }

            // Binary detection
            const stats = fs.statSync(fullPath);
            totalSize += stats.size;

            const isBinary = /\.(mp4|mov|zip|sqlite|db|png|jpg|bin)$/i.test(
              entry.name
            );
            if (isBinary) binarySize += stats.size;
          }
        }
      } catch {
        // Permission errors, symlinks, etc.
      }
    };

    walk(this.rootDir);

    const profile = this.profileEngine.detect();
    const binaryDensity = totalSize > 0 ? binarySize / totalSize : 0;

    return {
      timestamp: Date.now(),
      fileExtensions,
      directories,
      binaryDensity,
      frameworks: [...new Set(frameworks)],
      secrets,
      profile,
    };
  }

  /**
   * Detect drift between two snapshots.
   */
  private detectDrift(
    previous: WorkspaceSnapshot,
    current: WorkspaceSnapshot
  ): DriftDetected[] {
    const drift: DriftDetected[] = [];

    // Framework change
    if (JSON.stringify(previous.frameworks) !== JSON.stringify(current.frameworks)) {
      drift.push({
        type: "framework_change",
        description: `Frameworks changed from ${previous.frameworks} to ${current.frameworks}`,
        previous,
        current,
      });
    }

    // Language addition
    const prevExts = new Set(previous.fileExtensions.keys());
    const currExts = new Set(current.fileExtensions.keys());
    const newExts = [...currExts].filter((ext) => !prevExts.has(ext));
    if (newExts.length > 0) {
      drift.push({
        type: "language_addition",
        description: `New file extensions: ${newExts.join(", ")}`,
        previous,
        current,
      });
    }

    // ML artifacts
    if (
      !previous.frameworks.includes("ml") &&
      current.frameworks.includes("ml")
    ) {
      drift.push({
        type: "ml_artifacts",
        description: "ML artifacts detected (checkpoints, wandb)",
        previous,
        current,
      });
    }

    // Secret addition
    if (current.secrets.length > previous.secrets.length) {
      const newSecrets = current.secrets.filter(
        (s) => !previous.secrets.includes(s)
      );
      drift.push({
        type: "secret_addition",
        description: `New secrets detected: ${newSecrets.join(", ")}`,
        previous,
        current,
      });
    }

    // Binary spike (> 20% increase in binary density)
    if (
      current.binaryDensity - previous.binaryDensity > 0.2 ||
      current.binaryDensity > 0.5
    ) {
      drift.push({
        type: "binary_spike",
        description: `Binary density spike: ${(previous.binaryDensity * 100).toFixed(1)}% → ${(current.binaryDensity * 100).toFixed(1)}%`,
        previous,
        current,
      });
    }

    // Profile switch
    if (previous.profile !== current.profile) {
      drift.push({
        type: "framework_change",
        description: `Profile changed from ${previous.profile} to ${current.profile}`,
        previous,
        current,
      });
    }

    return drift;
  }

  /**
   * Perform healing actions based on detected drift.
   */
  private performHealing(driftList: DriftDetected[]): HealingAction[] {
    const actions: HealingAction[] = [];

    // Re-detect profile
    const newProfile = this.profileEngine.detect();
    if (newProfile !== (this.currentManifest?.name || "balanced")) {
      actions.push({
        type: "profile_switch",
        target: newProfile,
        reason: "Profile auto-detected change",
        timestamp: Date.now(),
      });

      this.currentManifest = this.profileEngine.getProfileByName(newProfile);
    }

    // Process each drift
    for (const drift of driftList) {
      switch (drift.type) {
        case "ml_artifacts":
          actions.push({
            type: "exclude",
            target: "checkpoints/",
            reason: "ML artifacts detected",
            timestamp: Date.now(),
          });
          actions.push({
            type: "exclude",
            target: "*.pt",
            reason: "ML artifacts detected",
            timestamp: Date.now(),
          });
          break;

        case "secret_addition":
          actions.push({
            type: "exclude",
            target: ".env.*",
            reason: "New secrets detected",
            timestamp: Date.now(),
          });
          break;

        case "binary_spike":
          if (drift.current.binaryDensity > 0.5) {
            actions.push({
              type: "size_cap_adjust",
              target: "250",
              reason: "Binary spike detected - lower size cap",
              timestamp: Date.now(),
            });
          }
          break;

        case "language_addition":
          // Language additions are logged but don't trigger exclusions
          // (we want to index new languages)
          break;

        case "framework_change":
          // Already handled by profile switch
          break;
      }
    }

    this.healingHistory.push(...actions);
    return actions;
  }

  /**
   * Get healing history.
   */
  getHealingHistory(): HealingAction[] {
    return [...this.healingHistory];
  }

  /**
   * Get current snapshot.
   */
  getCurrentSnapshot(): WorkspaceSnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * Get current manifest.
   */
  getCurrentManifest(): ExclusionProfile | null {
    return this.currentManifest;
  }

  /**
   * Manual trigger for scan (for testing).
   */
  forceRescan(): void {
    this.scan();
  }
}

export default SelfHealingEngine;
