// src/cli.mjs
// File: src/cli.mjs | Date: 2026-05-30 | v1.0.0
import { validateSingleItem } from "./skillopt/validator.mjs";
import { updateMetricsState } from "./skillopt/metricsState.mjs";
import path from "node:path"; // Import path module for version extraction

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case "skillopt:validate": {
      const [itemPath, outputPath] = args;
      const result = validateSingleItem(itemPath, outputPath);
      console.log(JSON.stringify(result, null, 2));

      // Update metrics state with new validation results
      updateMetricsState({
        lastValidation: result.metrics,
        lastValidationAt: new Date().toISOString() // Add timestamp for validation
      });
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
      // Optionally update a 'lastTrainedAt' timestamp in metricsState
      break;
    }
    case "skillopt:deploy": {
      const fs = await import("node:fs");
      const pathModule = await import("node:path"); // Use pathModule to avoid conflict with imported path

      const src = "./skillopt/best_skill.md";
      const dest = "./skills/rewritelabs/redesign/best_skill.md";

      if (!fs.existsSync(src)) {
        console.error("best_skill.md not found. Run skillopt:train first.");
        process.exit(1);
      }

      fs.copyFileSync(src, dest);
      console.log("[SkillOpt] Deployment complete.");

      // Extract version from dest path or assume a versioning scheme
      const skillFileName = pathModule.basename(dest); // e.g., best_skill.md
      // For now, let's assume a default version or a mechanism to get it
      // In a real scenario, version would be part of the skill file or a config.
      const currentSkillVersion = "1.0.0"; // Placeholder: Replace with actual version extraction logic

      // Update metrics state with deployment information
      updateMetricsState({
        currentSkillVersion: currentSkillVersion,
        lastDeployAt: new Date().toISOString()
      });
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