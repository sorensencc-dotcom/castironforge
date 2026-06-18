/**
 * CIC Exclusion Profile Subsystem
 *
 * Unified integration layer for:
 * - Auto-detecting engine
 * - Self-healing engine
 * - TorqueQuery adapter
 *
 * Features:
 * - Lifecycle hooks (init, start, stop, reload)
 * - Centralized logging
 * - Metrics collection
 * - Hot-reload support
 * - Agent-safe error boundaries
 */

import { EventEmitter } from "events";
import ExclusionProfileEngine, { ExclusionProfile } from "./exclusion-profile-engine";
import SelfHealingEngine from "./self-healing-engine";
import TorqueQueryAdapter from "./torquequery-adapter";

export interface SubsystemMetrics {
  profileDetections: number;
  healingActionsApplied: number;
  filtersGenerated: number;
  validationsPassed: number;
  validationsFailed: number;
  lastUpdateTimestamp: number;
  uptime: number;
}

export interface SubsystemConfig {
  rootDir?: string;
  selfHealingEnabled?: boolean;
  selfHealingScanIntervalMs?: number;
  metricsEnabled?: boolean;
  loggingLevel?: "silent" | "error" | "warn" | "info" | "debug";
}

export interface SubsystemState {
  initialized: boolean;
  running: boolean;
  currentProfile: string | null;
  currentManifest: ExclusionProfile | null;
  errorCount: number;
  lastError: Error | null;
}

export class CicExclusionSubsystem extends EventEmitter {
  private config: SubsystemConfig;
  private state: SubsystemState;
  private metrics: SubsystemMetrics;
  private engine: ExclusionProfileEngine;
  private healingEngine: SelfHealingEngine | null = null;
  private adapter: TorqueQueryAdapter | null = null;
  private startTime: number = 0;

  constructor(config: SubsystemConfig = {}) {
    super();

    this.config = {
      rootDir: config.rootDir || process.cwd(),
      selfHealingEnabled: config.selfHealingEnabled !== false,
      selfHealingScanIntervalMs: config.selfHealingScanIntervalMs || 10000,
      metricsEnabled: config.metricsEnabled !== false,
      loggingLevel: config.loggingLevel || "info",
    };

    this.state = {
      initialized: false,
      running: false,
      currentProfile: null,
      currentManifest: null,
      errorCount: 0,
      lastError: null,
    };

    this.metrics = {
      profileDetections: 0,
      healingActionsApplied: 0,
      filtersGenerated: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      lastUpdateTimestamp: 0,
      uptime: 0,
    };

    this.engine = new ExclusionProfileEngine(this.config.rootDir);
    this.setupErrorBoundaries();
  }

  /**
   * Initialize the subsystem.
   */
  async initialize(): Promise<void> {
    try {
      this.log("info", "[CIC Exclusion] Initializing subsystem");

      // Detect profile
      const profile = this.engine.detect();
      this.state.currentProfile = profile;

      // Load manifest
      this.state.currentManifest = this.engine.getProfileByName(profile);
      this.metrics.profileDetections++;

      // Create adapter
      this.adapter = new TorqueQueryAdapter(this.state.currentManifest);

      // Validate
      const validation = this.adapter.validate();
      if (validation.valid) {
        this.metrics.validationsPassed++;
      } else {
        this.metrics.validationsFailed++;
        this.log(
          "warn",
          `[CIC Exclusion] Validation failed: ${validation.errors.join(", ")}`
        );
      }

      this.state.initialized = true;
      this.log("info", `[CIC Exclusion] Initialized with profile: ${profile}`);
      this.emit("initialized", { profile, manifest: this.state.currentManifest });
    } catch (error) {
      this.handleError(error as Error, "initialize");
    }
  }

  /**
   * Start the subsystem (including self-healing engine if enabled).
   */
  start(): void {
    if (this.state.running) {
      this.log("warn", "[CIC Exclusion] Already running");
      return;
    }

    try {
      if (!this.state.initialized) {
        this.log("error", "[CIC Exclusion] Must initialize before starting");
        return;
      }

      this.log("info", "[CIC Exclusion] Starting subsystem");
      this.startTime = Date.now();

      // Start self-healing engine if enabled
      if (this.config.selfHealingEnabled) {
        this.healingEngine = new SelfHealingEngine(
          this.config.rootDir,
          this.config.selfHealingScanIntervalMs
        );

        this.healingEngine.on("initialized", (snapshot) => {
          this.log("debug", "[CIC Exclusion] Healing engine initialized");
          this.emit("healing_initialized", snapshot);
        });

        this.healingEngine.on("drift_detected", (drift) => {
          this.log("info", `[CIC Exclusion] Drift detected: ${drift.length} changes`);
          this.emit("drift_detected", drift);
        });

        this.healingEngine.on("healed", (actions) => {
          this.metrics.healingActionsApplied += actions.length;
          this.log("info", `[CIC Exclusion] Applied ${actions.length} healing actions`);
          this.emit("healed", actions);
        });

        this.healingEngine.start();
      }

      this.state.running = true;
      this.log("info", "[CIC Exclusion] Subsystem started");
      this.emit("started");
    } catch (error) {
      this.handleError(error as Error, "start");
    }
  }

  /**
   * Stop the subsystem.
   */
  stop(): void {
    if (!this.state.running) {
      this.log("warn", "[CIC Exclusion] Not running");
      return;
    }

    try {
      this.log("info", "[CIC Exclusion] Stopping subsystem");

      if (this.healingEngine) {
        this.healingEngine.stop();
      }

      this.state.running = false;
      this.log("info", "[CIC Exclusion] Subsystem stopped");
      this.emit("stopped");
    } catch (error) {
      this.handleError(error as Error, "stop");
    }
  }

  /**
   * Reload the entire subsystem (stop → initialize → start).
   */
  async reload(): Promise<void> {
    try {
      this.log("info", "[CIC Exclusion] Reloading subsystem");
      this.stop();
      await this.initialize();
      this.start();
      this.log("info", "[CIC Exclusion] Reload complete");
      this.emit("reloaded");
    } catch (error) {
      this.handleError(error as Error, "reload");
    }
  }

  /**
   * Get the current exclusion manifest (after profile detection and loading).
   */
  getManifest(): ExclusionProfile | null {
    return this.state.currentManifest;
  }

  /**
   * Get the detected profile name.
   */
  getProfile(): string | null {
    return this.state.currentProfile;
  }

  /**
   * Generate TorqueQuery configuration.
   */
  generateTorqueQueryConfig(): object {
    if (!this.adapter) {
      this.log("error", "[CIC Exclusion] Adapter not initialized");
      return {};
    }

    try {
      const config = this.adapter.toTorqueQueryJSON();
      this.metrics.filtersGenerated++;
      return config;
    } catch (error) {
      this.handleError(error as Error, "generateTorqueQueryConfig");
      return {};
    }
  }

  /**
   * Get subsystem metrics.
   */
  getMetrics(): SubsystemMetrics {
    if (this.startTime > 0) {
      this.metrics.uptime = Date.now() - this.startTime;
    }
    return { ...this.metrics };
  }

  /**
   * Get subsystem state.
   */
  getState(): SubsystemState {
    return { ...this.state };
  }

  /**
   * Manual revalidation of the current manifest.
   */
  validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    if (!this.adapter) {
      return {
        valid: false,
        errors: ["Adapter not initialized"],
        warnings: [],
      };
    }

    const result = this.adapter.validate();
    if (result.valid) {
      this.metrics.validationsPassed++;
    } else {
      this.metrics.validationsFailed++;
    }
    return result;
  }

  /**
   * Set up error boundaries for agent-safe operation.
   */
  private setupErrorBoundaries(): void {
    this.on("error", (error: Error) => {
      this.state.errorCount++;
      this.state.lastError = error;
      this.log("error", `[CIC Exclusion] Error: ${error.message}`);
    });
  }

  /**
   * Handle errors in a consistent way.
   */
  private handleError(error: Error, context: string): void {
    this.state.errorCount++;
    this.state.lastError = error;
    this.log(
      "error",
      `[CIC Exclusion] Error in ${context}: ${error.message}`
    );
    this.emit("error", error);
  }

  /**
   * Centralized logging.
   */
  private log(level: string, message: string): void {
    const levels = ["silent", "error", "warn", "info", "debug"];
    const configLevel = levels.indexOf(this.config.loggingLevel || "info");
    const msgLevel = levels.indexOf(level);

    if (msgLevel <= configLevel) {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Generate diagnostic report.
   */
  getDiagnostics(): {
    state: SubsystemState;
    metrics: SubsystemMetrics;
    profile: string | null;
    validation: { valid: boolean; errors: string[] };
    healingEngineActive: boolean;
  } {
    return {
      state: this.getState(),
      metrics: this.getMetrics(),
      profile: this.getProfile(),
      validation: this.validate(),
      healingEngineActive: this.healingEngine ? this.state.running : false,
    };
  }
}

// Singleton instance for global use
let globalSubsystem: CicExclusionSubsystem | null = null;

/**
 * Get or create the global subsystem instance.
 */
export async function getOrCreateSubsystem(
  config?: SubsystemConfig
): Promise<CicExclusionSubsystem> {
  if (!globalSubsystem) {
    globalSubsystem = new CicExclusionSubsystem(config);
    await globalSubsystem.initialize();
  }
  return globalSubsystem;
}

/**
 * Reset the global subsystem.
 */
export function resetGlobalSubsystem(): void {
  if (globalSubsystem) {
    globalSubsystem.stop();
    globalSubsystem.removeAllListeners();
    globalSubsystem = null;
  }
}

export default CicExclusionSubsystem;
