# Operator Runbook — Post-Ingestion Mover

When to run

- The mover runs automatically as part of `scripts/run-all.js`.  
- Run manually if archives, original recovery, or lineage need reconciliation: `node scripts/run-mover.js`.

How to run

- Dry run (no writes):
  node scripts/run-mover.js --dry-run

- Real run (defaults: moves originals and archives originals):
  node scripts/run-mover.js

- CLI toggles (optional):
  --move-originals        Enable moving originals into processed when processed missing (default: enabled)
  --no-move-originals     Disable moving originals into processed
  --archive-originals     Enable archiving originals if both processed and original exist (default: enabled)
  --no-archive-originals  Disable archiving originals (leave originals in inbox)

Examples

- Run but do not move originals (only archive processed files):
  node scripts/run-mover.js --no-move-originals

- Dry-run without performing any file or DB writes:
  node scripts/run-mover.js --dry-run

What it does

- If a processed copy exists, copies it to `_Archive/<category>/YYYY/MM/DD/<hash><ext>` (atomic copy).
- If the processed copy is missing but an original exists in an inbox folder, moves the original into the processed location, then archives the processed file.
- If both processed and original exist, moves the original to `_Archive/.../originals/` to avoid inbox duplication.
- Inserts a lineage record into the DB linking original_path → processed_path → archive_path.
- Is safe to re-run (idempotent).

Guarantees

- No double-moves, no deletion of processed assets (processed files remain unless an original is moved into processed to restore a missing processed copy).
- Writes are atomic and idempotent.  
- If an asset is missing, mover logs a warning and continues.

Verifying lineage for a file

1. Identify the file's hash or processed_path (from search_index).  
2. Query the DB:
   SELECT * FROM lineage WHERE hash_sha256 = '<hash>' OR processed_path LIKE '%/filename.ext';

Troubleshooting

- Archive missing but lineage present: check file system permissions and the archive directory.  
- Original left in inbox after run: check logs — mover will only move originals to archive or processed when it finds a reliable match (based on sidecar or hash).  
- Archive copy failed: run with --dry-run to preview and then re-run; check logs in the last mover run.
- DB errors: inspect migrations (src/db/migrate.js) and ensure DB is writable.

Logs

- Mover logs module 'mover' is available via main logging sink. Look for messages with 'Moved original to processed', 'Moved original to archive', 'Archived file' and 'Run completed'.
