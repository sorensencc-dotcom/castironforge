#!/usr/bin/env node
import fetch from "node-fetch";

const query = process.argv.slice(2).join(" ");

if (!query) {
  console.error("Usage: tq <query>");
  console.error("");
  console.error("Examples:");
  console.error("  tq WarmPoolManager");
  console.error("  tq 'Phase 27 adapter'");
  console.error("  tq 'how does hydration work'");
  process.exit(1);
}

const API_URL = process.env.TORQUEQUERY_API_URL ?? "http://localhost:5051";

async function main() {
  try {
    const url = `${API_URL}/hybrid?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Error: ${response.statusText}`);
      process.exit(1);
    }

    const data: any = await response.json();

    console.log(`\n🔍 TorqueQuery Hybrid Search: "${query}"`);
    console.log("--------------------------------------------------");

    if (data.results.length === 0) {
      console.log("No results found.");
      console.log("");
      process.exit(0);
    }

    for (const hit of data.results.slice(0, 20)) {
      const score = hit.hybridScore.toFixed(3);
      const strategy =
        hit.keywordScore > 0 && hit.vectorScore > 0
          ? "🔄"
          : hit.keywordScore > 0
            ? "📝"
            : "🧠";

      console.log(
        `  ${strategy} ${score}  ${hit.path.padEnd(50)} (${hit.repo})`
      );
    }

    console.log("");
    console.log(
      `Total: ${data.results.length} result(s) | Strategy: keyword (📝) | semantic (🧠) | hybrid (🔄)`
    );
    console.log("");
  } catch (err) {
    console.error("Error:", String(err));
    process.exit(1);
  }
}

main();
