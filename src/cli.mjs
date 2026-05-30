// src/cli.mjs
// File: src/cli.mjs | Date: 2026-05-30 | v1.0.0
import { validateSingleItem } from "./skillopt/validator.mjs";

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case "skillopt:validate": {
      const [itemPath, outputPath] = args;
      const result = validateSingleItem(itemPath, outputPath);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "skillopt:train": {
      const { spawnSync } = await import("node:child_process");

      console.log("[SkillOpt] Training started…");

      const result = spawnSync("python3", ["./skillopt/train.py"], {
        stdio: "inherit"
      });

      if (result.status !== 0) {
        console.error("[SkillOpt] Training failed.");
        process.exit(1);
      }

      console.log("[SkillOpt] Training complete.");
      break;
    }
    case "skillopt:deploy": {
      const fs = await import("node:fs");
      const path = await import("node:path");

      const src = "./skillopt/best_skill.md";
      const dest = "./skills/rewritelabs/redesign/best_skill.md";

      if (!fs.existsSync(src)) {
        console.error("best_skill.md not found. Run skillopt:train first.");
        process.exit(1);
      }

      fs.copyFileSync(src, dest);
      console.log("[SkillOpt] Deployment complete.");
      break;
    }
    default: {
      console.log(`Unknown command: ${cmd}`);
      console.log("Usage: node src/cli.mjs <command> [args]");
      break;
    }
  }
}

main().catch(console.error);