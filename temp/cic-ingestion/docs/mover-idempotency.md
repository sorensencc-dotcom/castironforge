# Mover/Archiver Idempotency & Safety Guarantees

Guarantees

- Running the mover multiple times will not duplicate archives or lineage entries.
- Archives are written atomically via temp files and rename.
- The mover never deletes processed files; it may move original inbox files into processed or archive them, but will not lose content (moves are cross-volume-safe).
- If the processed file is missing but an original is found in an inbox location, the mover will move the original into the processed location and then archive it (idempotent).

Failure modes

- ENOENT on processed file or original: logged and skipped (safe).  
- Permission / IO errors during file operations: logged as errors; mover continues with other files.

Operator actions

- Safe to re-run with `scripts/run-mover.js --dry-run` to preview operations.
- Check `lineage` DB table to confirm successful archival and original moves.
