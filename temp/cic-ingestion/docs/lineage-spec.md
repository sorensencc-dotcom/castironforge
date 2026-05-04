# Lineage Specification

Purpose

Lineage provides an auditable mapping from an ingested asset's processing lifecycle: original_path → processed_path → sidecar_path → archive_path → search_index entry.

Schema (summary)

- Table: lineage
  - id INTEGER PRIMARY KEY
  - search_index_id INTEGER — FK to search_index(id)
  - hash_sha256 TEXT — content hash if available
  - original_path TEXT — original source path if known (may be NULL)
  - processed_path TEXT — final path in CIC_Processed
  - sidecar_path TEXT — path to the sidecar JSON
  - archive_path TEXT — deterministic archive path under _Archive
  - created_at TEXT — timestamp

Uniqueness & idempotency

- Unique index on (hash_sha256, processed_path) ensures re-running the mover will not create duplicate lineage entries.

Correlation with other tables

- search_index contains the searchable metadata; lineage.search_index_id references it.
- The files table may be extended in the future; current mover uses search_index as the canonical post-index record.

Query examples

- Get lineage for a known filename/hash:
  SELECT * FROM lineage WHERE hash_sha256 = '...' OR processed_path LIKE '%/myfile.docx';

- Find archive path for a search_index id:
  SELECT archive_path FROM lineage WHERE search_index_id = 42;
