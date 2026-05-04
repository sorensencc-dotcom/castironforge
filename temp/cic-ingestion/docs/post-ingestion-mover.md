# Post-Ingestion Mover & Archive Subsystem

Overview

This subsystem provides a unified, idempotent post-ingestion stage that:  
- Ensures every ingested asset has a deterministic archive copy under _Archive.  
- Attempts to recover original source files left in inbox and move them into CIC_Processed when appropriate.
- Records lineage linking original_path → processed_path → sidecar_path → archive_path → search_index entry.
- Is safe to re-run (idempotent), tolerant of transient ENOENT conditions, and never loses files.

Key features

- Deterministic archive path: `_Archive/<category>/YYYY/MM/DD/<hash><ext>` when available.
- If a processed copy is missing but an original exists in an inbox folder, the mover will move the original into processed (idempotent). This behavior can be toggled with --move-originals / --no-move-originals.
- If both processed and original exist, the original is moved to `_Archive/.../originals/` to avoid inbox duplication. This behavior can be toggled with --archive-originals / --no-archive-originals.
- Lineage recorded in new DB table `lineage` (see docs/lineage-spec.md).
- Runs as `scripts/run-mover.js` and is integrated into `scripts/run-all.js` as the `mover` stage (after sweeper, before indexer).

Operator directives, guarantees, and examples are in docs/operator-runbooks/mover-runbook.md.
