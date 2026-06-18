/**
 * CIC Exclusion Agent Wrapper
 *
 * A first-class CIC agent that continuously enforces the 4-layer exclusion model,
 * self-heals based on workspace drift, and updates TorqueQuery filters.
 *
 * Responsibilities:
 * - Run exclusion engine on startup
 * - Recompute manifest on workspace drift
 * - Push updated filters to TorqueQuery
 * - Emit structured logs for the dashboard
 * - Maintain a rolling exclusion timeline
 * - Expose health endpoint for CIC Observability
 */

import { EventEmitter } from "events";
import ExclusionProfileEngine from "./exclusion-profile-engine";
import SelfHealingEngine from "./self-healing-engine";
import TorqueQueryAdapter from "./torquequery-adapter";
import { ExclusionProfile } from "./exclusion-profile-engine";

export interface TorqueQueryFilterSet {
  exclude: string[];
  include: string[];
  sizeCap: number;
  languageWhitelist: string[];
}

export interface IngestionTimelineEntry {
  timestamp: number;
  profile: string;
  manifest: ExclusionProfile;
  filters: TorqueQueryFilterSet;
  drift?: {
    binarySpike: boolean;
    newSecrets: boolean;
    newFramework: boolean;
    profileChanged: boolean;
  };
}

export interface AgentHealth {
  status: "online" | "offline" | "degraded";
  uptime: number;
  lastUpdate: number;
  driftEventsDetected: number;
  timelineEntries: number;
  profile: string | null;
  lastError: string | null;
}

export interface TorqueQueryConfig {
  mode: "balanced";
  profile: string;
  filters: TorqueQueryFilterSet;
}

export class ExclusionAgent extends EventEmitter {
  private profileEngine: ExclusionProfileEngine;
  private healingEngine: SelfHealingEngine;
  private currentAdapter: TorqueQueryAdapter | null = null;
  private currentManifest: ExclusionProfile | null = null;
  private timeline: IngestionTimelineEntry[] = [];
  private scanTimer: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private driftEventsDetected: number = 0;
  private lastError: string | null = null;
  private rootDir: string;
  private torqueQueryEndpoint: string;

  constructor(
    rootDir: string = process.cwd(),
    torqueQueryEndpoint: string = "http://localhost:9000"
  ) {
    super();
    this.rootDir = rootDir;
    this.torqueQueryEndpoint = torqueQueryEndpoint;
    this.profileEngine = new ExclusionProfileEngine(rootDir);
    this.healingEngine = new SelfHealingEngine(rootDir, 5000);
  }

  /**
   * Start the exclusion agent.
   */
  async start(): Promise<void> {
    this.startTime = Date.now();
    console.log("[ExclusionAgent] Starting");

    try {
      // Initial profile detection and manifest loading
      await this.updateManifest();

      // Wire up healing engine events
      this.healingEngine.on("drift_detected", (drift) => {
        this.driftEventsDetected++;
        console.log(
          `[ExclusionAgent] Drift detected: ${drift.length} changes`
        );
        this.emit("drift_detected", drift);
      });

      this.healingEngine.on("healed", (actions) => {
        console.log(
          `[ExclusionAgent] Healing applied: ${actions.length} actions`
        );
        this.updateManifest().catch((err) => {
          this.lastError = err.message;
          this.emit("error", err);
        });
      });

      // Start healing engine
      this.healingEngine.start();

      // Run update cycles
      this.scanTimer = setInterval(() => {
        this.updateManifest().catch((err) => {
          this.lastError = err.message;
          this.emit("error", err);
        });
      }, 10000);

      console.log("[ExclusionAgent] Started successfully");
      this.emit("started");
    } catch (error) {
      this.lastError = (error as Error).message;
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Stop the exclusion agent.
   */
  stop(): void {
    console.log("[ExclusionAgent] Stopping");

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    this.healingEngine.stop();
    console.log("[ExclusionAgent] Stopped");
    this.emit("stopped");
  }

  /**
   * Update the manifest and push to TorqueQuery.
   */
  private async updateManifest(): Promise<void> {
    try {
      const profile = this.profileEngine.detect();
      const manifest = this.profileEngine.getProfileByName(profile);
      const adapter = new TorqueQueryAdapter(manifest);

      // Validate
      const validation = adapter.validate();
      if (!validation.valid) {
        console.warn(
          `[ExclusionAgent] Validation failed: ${validation.errors.join(", ")}`
        );
      }

      this.currentManifest = manifest;
      this.currentAdapter = adapter;

      // Generate filters
      const filters = this.buildFilterSet(adapter);

      // Create timeline entry
      const entry: IngestionTimelineEntry = {
        timestamp: Date.now(),
        profile,
        manifest,
        filters,
      };

      this.timeline.push(entry);

      // Emit event
      this.emit("manifest_updated", {
        profile,
        timestamp: entry.timestamp,
        filterCount: filters.exclude.length + filters.include.length,
      });

      // Log to stdout (for structured logging)
      console.log(
        JSON.stringify({
          event: "exclusion.update",
          timestamp: entry.timestamp,
          profile,
          filterCount: filters.exclude.length + filters.include.length,
        })
      );
    } catch (error) {
      this.lastError = (error as Error).message;
      throw error;
    }
  }

  /**
   * Build TorqueQuery filter set from adapter.
   */
  private buildFilterSet(adapter: TorqueQueryAdapter): TorqueQueryFilterSet {
    const tqJson = adapter.toTorqueQueryJSON() as any;
    const ingestion = tqJson.ingestion;

    return {
      exclude: ingestion.filters.exclude || [],
      include: ingestion.filters.include || [],
      sizeCap: ingestion.filters.size_cap_kb || 500,
      languageWhitelist: ingestion.filters.language_whitelist || [],
    };
  }

  /**
   * Get current health status.
   */
  getHealth(): AgentHealth {
    const uptime = this.startTime > 0 ? Date.now() - this.startTime : 0;

    return {
      status: this.lastError ? "degraded" : "online",
      uptime,
      lastUpdate:
        this.timeline.length > 0
          ? this.timeline[this.timeline.length - 1].timestamp
          : 0,
      driftEventsDetected: this.driftEventsDetected,
      timelineEntries: this.timeline.length,
      profile:
        this.timeline.length > 0
          ? this.timeline[this.timeline.length - 1].profile
          : null,
      lastError: this.lastError,
    };
  }

  /**
   * Get active TorqueQuery config.
   */
  getTorqueQueryConfig(): TorqueQueryConfig | null {
    if (!this.currentManifest || this.timeline.length === 0) {
      return null;
    }

    const latestEntry = this.timeline[this.timeline.length - 1];

    return {
      mode: "balanced",
      profile: latestEntry.profile,
      filters: latestEntry.filters,
    };
  }

  /**
   * Get the ingestion timeline (with optional limit).
   */
  getTimeline(limit: number = 50): IngestionTimelineEntry[] {
    return this.timeline.slice(-limit);
  }

  /**
   * Get a specific timeline entry by timestamp.
   */
  getTimelineEntry(timestamp: number): IngestionTimelineEntry | null {
    return (
      this.timeline.find((entry) => entry.timestamp === timestamp) || null
    );
  }

  /**
   * Get diff between two timeline states.
   */
  getTimelineDiff(
    fromTimestamp: number,
    toTimestamp: number
  ): {
    addedExclusions: string[];
    removedExclusions: string[];
    addedInclusions: string[];
    removedInclusions: string[];
    profileChanged: boolean;
    sizeCap: { from: number; to: number } | null;
  } | null {
    const fromEntry = this.timeline.find((e) => e.timestamp === fromTimestamp);
    const toEntry = this.timeline.find((e) => e.timestamp === toTimestamp);

    if (!fromEntry || !toEntry) {
      return null;
    }

    const fromExcludes = new Set(fromEntry.filters.exclude);
    const toExcludes = new Set(toEntry.filters.exclude);
    const fromIncludes = new Set(fromEntry.filters.include);
    const toIncludes = new Set(toEntry.filters.include);

    return {
      addedExclusions: Array.from(toExcludes).filter((x) => !fromExcludes.has(x)),
      removedExclusions: Array.from(fromExcludes).filter((x) => !toExcludes.has(x)),
      addedInclusions: Array.from(toIncludes).filter((x) => !fromIncludes.has(x)),
      removedInclusions: Array.from(fromIncludes).filter((x) => !toIncludes.has(x)),
      profileChanged: fromEntry.profile !== toEntry.profile,
      sizeCap:
        fromEntry.filters.sizeCap !== toEntry.filters.sizeCap
          ? { from: fromEntry.filters.sizeCap, to: toEntry.filters.sizeCap }
          : null,
    };
  }

  /**
   * Get current manifest.
   */
  getManifest(): ExclusionProfile | null {
    return this.currentManifest;
  }

  /**
   * Get diagnostic report.
   */
  getDiagnostics(): object {
    return {
      health: this.getHealth(),
      tq_config: this.getTorqueQueryConfig(),
      timeline_length: this.timeline.length,
      recent_entries: this.getTimeline(5),
      manifest: this.currentManifest
        ? {
            name: this.currentManifest.name,
            exclude_count: this.currentManifest.exclude.length,
            include_count: this.currentManifest.include.length,
            file_size_cap_kb: this.currentManifest.fileSizeCapKB,
          }
        : null,
    };
  }
}

export default ExclusionAgent;
