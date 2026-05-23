import path from "path";
import { LivingDocSourceConfig } from "./types.js";

export interface LivingDocsConfig {
  enabled: boolean;
  sources: LivingDocSourceConfig[];
}

export function loadLivingDocsConfig(): LivingDocsConfig {
  const root = process.env.CIC_ROOT || process.cwd();

  const krollPath =
    process.env.CIC_LIVING_DOCS_KROLL_PATH ||
    path.join(root, "Living_Docs", "Kroll_Log");

  const treatmentPath =
    process.env.CIC_LIVING_DOCS_TREATMENT_PATH ||
    path.join(root, "Living_Docs", "Treatment");

  const qfdPath =
    process.env.CIC_LIVING_DOCS_QFD_PATH ||
    path.join(root, "Living_Docs", "QFD");

  const sources: LivingDocSourceConfig[] = [
    {
      id: "kroll_log",
      label: "Kroll Log",
      kind: "kroll_log",
      path: krollPath,
      recursive: true,
      includePatterns: ["**/*.md", "**/*.txt"],
      excludePatterns: ["**/.DS_Store", "**/Thumbs.db"]
    },
    {
      id: "treatment",
      label: "Treatment",
      kind: "treatment",
      path: treatmentPath,
      recursive: true,
      includePatterns: ["**/*.md", "**/*.txt"],
      excludePatterns: ["**/.DS_Store", "**/Thumbs.db"]
    },
    {
      id: "qfd",
      label: "QFD",
      kind: "qfd",
      path: qfdPath,
      recursive: true,
      includePatterns: ["**/*.md", "**/*.txt"],
      excludePatterns: ["**/.DS_Store", "**/Thumbs.db"]
    }
  ];

  return {
    enabled: process.env.CIC_LIVING_DOCS_ENABLED !== "false",
    sources
  };
}
