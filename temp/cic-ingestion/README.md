# CIC Ingestion — README (updated)

Added: Post-Ingestion Mover & Archive Subsystem (moves originals when needed)

Summary

A new post-ingestion stage (`mover`) archives processed assets deterministically, recovers originals left in inbox by moving them into CIC_Processed when appropriate, and records lineage in the DB. The mover is integrated into `scripts/run-all.js` between `sweeper` and `indexer`.

See docs/post-ingestion-mover.md and docs/operator-runbooks/mover-runbook.md for operator guidance.
