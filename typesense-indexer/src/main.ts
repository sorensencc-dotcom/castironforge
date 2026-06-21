import { ensureSchema } from "./schema.js";
import { startWatcher } from "./watcher.js";
import { log } from "./logger.js";

const main = async () => {
  log("Starting Typesense repo indexer...");
  try {
    await ensureSchema();
    startWatcher();
    log("Indexer ready. Watching for changes...");
  } catch (err) {
    log("Failed to start indexer:", String(err));
    process.exit(1);
  }
};

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  log("Shutting down...");
  process.exit(0);
});
