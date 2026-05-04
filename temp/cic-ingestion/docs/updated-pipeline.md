# Updated Pipeline Diagram (text)

Order of stages (run-all):

1. init
2. folders-maintenance
3. harvester
4. sweeper
5. mover    <-- NEW: post-ingestion mover & archiver
6. indexer
7. corpus
8. pipeline
9. status

Notes

- The mover runs after the sweeper to ensure newly discovered files are present and before the indexer so that archived copies and lineage exist when indexing completes.
- The mover is idempotent and safe to re-run without affecting earlier stages.
