// File: src/living-docs/types.ts | Date: 2026-05-18 | v1.0.0

export type LivingDocId = string;

export interface LivingDocConfig {
  id: LivingDocId;
  label: string;
  localPath: string;          // e.g. "docs/treatment/TREATMENT.md"
  provider: "google" | "onedrive";
  remoteId: string;           // Drive fileId / OneDrive itemId
  direction: "pull" | "push" | "bidirectional";
  conflictStrategy: "prompt" | "local-wins" | "remote-wins";
}

export interface LivingDocState {
  id: LivingDocId;
  localPath: string;
  localHash: string | null;
  remoteHash: string | null;
  lastSyncAt: string | null;  // ISO
  lastSyncDirection: "pull" | "push" | "bidirectional" | null;
}

export interface RemoteDoc {
  exists: boolean;
  content: string | null;
  hash: string | null;
  lastModifiedAt: string | null; // ISO
}

export interface SyncResult {
  id: LivingDocId;
  label: string;
  localPath: string;
  provider: string;
  action: "NOOP" | "PULL_REMOTE_TO_LOCAL" | "PUSH_LOCAL_TO_REMOTE" | "CONFLICT_RESOLUTION_REQUIRED" | "ERROR";
  status: "OK" | "SKIPPED" | "FAILED";
  reason?: string;
  localHash?: string | null;
  remoteHash?: string | null;
}
