// Shared request/response types for the CIC Memory Spine API.
// All shapes match the spec in docs/memory-spine/API.md exactly.

// MemoryQuery

export interface MemoryQueryRequest {
  query_text: string;
  task_type?: string;
  domain?: string;
  time_hint?: string;
  max_tokens?: number;
}

export interface ProvenanceRef {
  doc_id: string;
  chunk_id: string;
  timestamp: string;
}

export interface MemoryQueryResponse {
  answer_text: string;
  provenance: ProvenanceRef[];
  confidence: number;
  memory_version: string;
}

// MemoryEdit

export type EditOperation = 'add' | 'update' | 'delete';

export interface EditPayload {
  title?: string;
  content?: string;
  domain?: string;
  tags?: string[];
}

export interface MemoryEditRequest {
  operation: EditOperation;
  doc_id: string;
  payload?: EditPayload;
}

export interface MemoryEditResponse {
  status: 'ok' | 'error';
  version: string;
}

// MemoryAdmin

export interface AdminActivateRequest {
  target_version: string;
}

export interface AdminActivateResponse {
  active_version: string;
  previous_version: string;
}

export interface AdminRollbackRequest {
  to_version?: string;
}

export interface AdminRollbackResponse {
  active_version: string;
  rolled_back_from: string;
}

export interface AdminStatusResponse {
  active_version: string;
  available_versions: string[];
  corpus_doc_count: number;
  last_edit: string | null;
}

// MemoryProvenance

export interface ProvenanceHistoryEntry {
  version: string;
  timestamp: string;
}

export interface MemoryProvenanceResponse {
  doc_id: string;
  history: ProvenanceHistoryEntry[];
}

// Error

export interface ApiError {
  error: string;
  message: string;
  status: number;
}
