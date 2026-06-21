import chokidar from "chokidar";
import path from "path";
import { CONFIG } from "./config.js";
import { log } from "./logger.js";
import { indexFile, deleteFile } from "./indexer.js";

const shouldIndex = (filePath: string) => {
  const ext = path.extname(filePath);
  if (!CONFIG.includeExtensions.includes(ext)) return false;
  return !CONFIG.excludeDirs.some(d => filePath.includes(`/${d}/`) || filePath.includes(`\\${d}\\`));
};

export const startWatcher = () => {
  for (const repo of CONFIG.repos) {
    const watcher = chokidar.watch(repo.root, {
      ignoreInitial: false,
      persistent: true,
      ignored: (filepath: string) => {
        return CONFIG.excludeDirs.some(d => filepath.includes(`/${d}/`) || filepath.includes(`\\${d}\\`));
      }
    });

    watcher
      .on("add", async filePath => {
        if (!shouldIndex(filePath)) return;
        log("ADD", filePath);
        await indexFile({ path: filePath, repo: repo.name });
      })
      .on("change", async filePath => {
        if (!shouldIndex(filePath)) return;
        log("CHANGE", filePath);
        await indexFile({ path: filePath, repo: repo.name });
      })
      .on("unlink", async filePath => {
        if (!shouldIndex(filePath)) return;
        log("UNLINK", filePath);
        await deleteFile({ path: filePath, repo: repo.name });
      })
      .on("error", (error: Error) => {
        log("Watcher error:", error.message);
      });

    log("Watcher started for repo:", repo.name, "root:", repo.root);
  }
};
