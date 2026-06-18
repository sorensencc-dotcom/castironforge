/**
 * TorqueQuery Ingestion Timeline Recorder
 *
 * Chronological record of all exclusion updates, profile switches, drift events,
 * and TorqueQuery filter changes. Designed for debugging, regression detection,
 * and agent-to-agent coordination.
 *
 * Supports querying by timestamp, diffing between states, and timeline analysis.
 */

import fs from "fs";
import path from "path";

export interface TimelineSnapshot {
  timestamp: number;
  profile: string;
  excludeCount: number;
  includeCount: number;
  fileSizeCapKB: number;
  languageWhitelistCount: number;
  driftDetected: boolean;
  metadata?: Record<string, unknown>;
}

export interface TimelineDiff {
  fromTimestamp: number;
  toTimestamp: number;
  duration: number;
  addedExclusions: string[];
  removedExclusions: string[];
  addedInclusions: string[];
  removedInclusions: string[];
  profileChanged: boolean;
  profileFrom?: string;
  profileTo?: string;
  sizeCapsChanged: boolean;
  sizeCaps?: { from: number; to: number };
}

export interface TimelineStats {
  totalSnapshots: number;
  timeRange: { start: number; end: number };
  profileChanges: number;
  driftEvents: number;
  averageUpdateInterval: number;
  mostCommonProfile: string;
}

export class IngestionTimeline {
  private snapshots: TimelineSnapshot[] = [];
  private persistPath: string | null = null;
  private maxSnapshots: number = 1000;

  constructor(persistPath?: string, maxSnapshots: number = 1000) {
    this.persistPath = persistPath || null;
    this.maxSnapshots = maxSnapshots;

    if (this.persistPath && fs.existsSync(this.persistPath)) {
      this.load();
    }
  }

  /**
   * Record a new snapshot in the timeline.
   */
  record(
    profile: string,
    excludeCount: number,
    includeCount: number,
    fileSizeCapKB: number,
    languageWhitelistCount: number,
    driftDetected: boolean = false,
    metadata?: Record<string, unknown>
  ): void {
    const snapshot: TimelineSnapshot = {
      timestamp: Date.now(),
      profile,
      excludeCount,
      includeCount,
      fileSizeCapKB,
      languageWhitelistCount,
      driftDetected,
      metadata,
    };

    this.snapshots.push(snapshot);

    // Enforce max snapshots (FIFO)
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    this.persist();
  }

  /**
   * Get all snapshots (or limited by recency).
   */
  getSnapshots(limit?: number): TimelineSnapshot[] {
    if (!limit) {
      return [...this.snapshots];
    }
    return this.snapshots.slice(-limit);
  }

  /**
   * Get a snapshot by timestamp (exact or nearest).
   */
  getSnapshot(timestamp: number, nearestMs: number = 1000): TimelineSnapshot | null {
    const exact = this.snapshots.find((s) => s.timestamp === timestamp);
    if (exact) return exact;

    // Find nearest within tolerance
    const nearest = this.snapshots.reduce((closest, snap) => {
      const diff = Math.abs(snap.timestamp - timestamp);
      const closestDiff = Math.abs(closest.timestamp - timestamp);
      return diff < closestDiff ? snap : closest;
    });

    if (Math.abs(nearest.timestamp - timestamp) <= nearestMs) {
      return nearest;
    }

    return null;
  }

  /**
   * Get the most recent snapshot.
   */
  getLatest(): TimelineSnapshot | null {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null;
  }

  /**
   * Compute diff between two snapshots.
   */
  diff(from: TimelineSnapshot, to: TimelineSnapshot): TimelineDiff {
    return {
      fromTimestamp: from.timestamp,
      toTimestamp: to.timestamp,
      duration: to.timestamp - from.timestamp,
      addedExclusions: this.estimateAddedExclusions(from, to),
      removedExclusions: this.estimateRemovedExclusions(from, to),
      addedInclusions: this.estimateAddedInclusions(from, to),
      removedInclusions: this.estimateRemovedInclusions(from, to),
      profileChanged: from.profile !== to.profile,
      profileFrom: from.profile,
      profileTo: to.profile,
      sizeCapsChanged: from.fileSizeCapKB !== to.fileSizeCapKB,
      sizeCaps:
        from.fileSizeCapKB !== to.fileSizeCapKB
          ? { from: from.fileSizeCapKB, to: to.fileSizeCapKB }
          : undefined,
    };
  }

  /**
   * Get timeline diff between two timestamps.
   */
  getDiff(from: number, to: number): TimelineDiff | null {
    const fromSnap = this.getSnapshot(from);
    const toSnap = this.getSnapshot(to);

    if (!fromSnap || !toSnap) {
      return null;
    }

    return this.diff(fromSnap, toSnap);
  }

  /**
   * Get statistics about the timeline.
   */
  getStats(): TimelineStats {
    if (this.snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        timeRange: { start: 0, end: 0 },
        profileChanges: 0,
        driftEvents: 0,
        averageUpdateInterval: 0,
        mostCommonProfile: "unknown",
      };
    }

    const profileMap = new Map<string, number>();
    let profileChanges = 0;
    let driftEvents = 0;
    let prevProfile = "";

    for (const snap of this.snapshots) {
      profileMap.set(snap.profile, (profileMap.get(snap.profile) || 0) + 1);
      if (prevProfile && snap.profile !== prevProfile) {
        profileChanges++;
      }
      if (snap.driftDetected) {
        driftEvents++;
      }
      prevProfile = snap.profile;
    }

    const mostCommonProfile = Array.from(profileMap.entries()).sort(
      ([, a], [, b]) => b - a
    )[0][0];

    const timeRange = {
      start: this.snapshots[0].timestamp,
      end: this.snapshots[this.snapshots.length - 1].timestamp,
    };

    const averageUpdateInterval =
      this.snapshots.length > 1
        ? (timeRange.end - timeRange.start) / (this.snapshots.length - 1)
        : 0;

    return {
      totalSnapshots: this.snapshots.length,
      timeRange,
      profileChanges,
      driftEvents,
      averageUpdateInterval,
      mostCommonProfile,
    };
  }

  /**
   * Get all profile changes in chronological order.
   */
  getProfileChanges(): Array<{
    from: string;
    to: string;
    timestamp: number;
  }> {
    const changes = [];

    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1];
      const curr = this.snapshots[i];

      if (prev.profile !== curr.profile) {
        changes.push({
          from: prev.profile,
          to: curr.profile,
          timestamp: curr.timestamp,
        });
      }
    }

    return changes;
  }

  /**
   * Get all drift events.
   */
  getDriftEvents(): TimelineSnapshot[] {
    return this.snapshots.filter((s) => s.driftDetected);
  }

  /**
   * Query timeline by time range.
   */
  queryTimeRange(startMs: number, endMs: number): TimelineSnapshot[] {
    return this.snapshots.filter(
      (s) => s.timestamp >= startMs && s.timestamp <= endMs
    );
  }

  /**
   * Query timeline by profile.
   */
  queryByProfile(profile: string): TimelineSnapshot[] {
    return this.snapshots.filter((s) => s.profile === profile);
  }

  /**
   * Persist timeline to disk (if path was provided).
   */
  private persist(): void {
    if (!this.persistPath) return;

    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.persistPath,
        JSON.stringify(
          {
            version: "1.0.0",
            persisted_at: new Date().toISOString(),
            snapshots: this.snapshots,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error("[IngestionTimeline] Persist error:", error);
    }
  }

  /**
   * Load timeline from disk.
   */
  private load(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, "utf-8"));
      this.snapshots = data.snapshots || [];
    } catch (error) {
      console.error("[IngestionTimeline] Load error:", error);
    }
  }

  /**
   * Clear the timeline.
   */
  clear(): void {
    this.snapshots = [];
    this.persist();
  }

  /**
   * Export timeline as JSON.
   */
  export(): object {
    return {
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      stats: this.getStats(),
      snapshots: this.snapshots,
      profile_changes: this.getProfileChanges(),
      drift_events: this.getDriftEvents(),
    };
  }

  /**
   * Helper: estimate added exclusions based on count delta.
   */
  private estimateAddedExclusions(from: TimelineSnapshot, to: TimelineSnapshot): string[] {
    const delta = to.excludeCount - from.excludeCount;
    if (delta <= 0) return [];

    return Array(delta)
      .fill(null)
      .map((_, i) => `<exclusion_${i + 1}>`);
  }

  /**
   * Helper: estimate removed exclusions based on count delta.
   */
  private estimateRemovedExclusions(from: TimelineSnapshot, to: TimelineSnapshot): string[] {
    const delta = from.excludeCount - to.excludeCount;
    if (delta <= 0) return [];

    return Array(delta)
      .fill(null)
      .map((_, i) => `<removed_exclusion_${i + 1}>`);
  }

  /**
   * Helper: estimate added inclusions based on count delta.
   */
  private estimateAddedInclusions(from: TimelineSnapshot, to: TimelineSnapshot): string[] {
    const delta = to.includeCount - from.includeCount;
    if (delta <= 0) return [];

    return Array(delta)
      .fill(null)
      .map((_, i) => `<inclusion_${i + 1}>`);
  }

  /**
   * Helper: estimate removed inclusions based on count delta.
   */
  private estimateRemovedInclusions(from: TimelineSnapshot, to: TimelineSnapshot): string[] {
    const delta = from.includeCount - to.includeCount;
    if (delta <= 0) return [];

    return Array(delta)
      .fill(null)
      .map((_, i) => `<removed_inclusion_${i + 1}>`);
  }
}

export default IngestionTimeline;
