#!/usr/bin/env node
import minimist from "minimist";
import fetch from "node-fetch";

const argv = minimist(process.argv.slice(2));

const API_URL = process.env.SEARCH_API_URL ?? "http://localhost:5050";

type SearchOptions = {
  query?: string;
  repo?: string;
  language?: string;
  phase?: string;
  adapter?: string;
  queryBy?: string;
  perPage?: number;
  symbols?: boolean;
  functions?: boolean;
  imports?: boolean;
  exports?: boolean;
  todos?: boolean;
};

function buildSearchParams(opts: SearchOptions): URLSearchParams {
  const params = new URLSearchParams();

  if (!opts.query) {
    throw new Error("Query is required");
  }

  params.set("q", opts.query);

  let queryBy = "content,symbols,imports";
  if (opts.symbols) queryBy = "symbols";
  else if (opts.functions) queryBy = "functions";
  else if (opts.imports) queryBy = "imports";
  else if (opts.exports) queryBy = "exports";
  else if (opts.todos) queryBy = "todos";
  else if (opts.queryBy) queryBy = opts.queryBy;

  params.set("query_by", queryBy);

  if (opts.repo) params.set("repo", opts.repo);
  if (opts.language) params.set("language", opts.language);
  if (opts.phase) params.set("phase", opts.phase);
  if (opts.adapter) params.set("adapter", opts.adapter);
  if (opts.perPage) params.set("per_page", String(opts.perPage));

  return params;
}

function formatResult(result: any): string {
  const lines: string[] = [];

  lines.push(`📄 ${result.path}`);

  if (result.language) {
    lines.push(`   lang: ${result.language}`);
  }

  if (result.repo) {
    lines.push(`   repo: ${result.repo}`);
  }

  if (result.phase) {
    lines.push(`   phase: ${result.phase}`);
  }

  if (result.adapter) {
    lines.push(`   adapter: ${result.adapter}`);
  }

  if (result.symbols && result.symbols.length > 0) {
    lines.push(`   symbols: ${result.symbols.slice(0, 5).join(", ")}`);
  }

  if (result.functions && result.functions.length > 0) {
    lines.push(`   functions: ${result.functions.slice(0, 3).join(", ")}`);
  }

  if (result.classes && result.classes.length > 0) {
    lines.push(`   classes: ${result.classes.slice(0, 3).join(", ")}`);
  }

  return lines.join("\n");
}

async function main() {
  try {
    const query = argv._.join(" ");

    const opts: SearchOptions = {
      query,
      repo: argv.repo,
      language: argv.language,
      phase: argv.phase,
      adapter: argv.adapter,
      queryBy: argv["query-by"],
      perPage: argv["per-page"] ? Number(argv["per-page"]) : undefined,
      symbols: argv.symbols,
      functions: argv.functions,
      imports: argv.imports,
      exports: argv.exports,
      todos: argv.todos
    };

    if (!opts.query) {
      console.error("Usage: ts-find [OPTIONS] QUERY");
      console.error("");
      console.error("Options:");
      console.error("  --repo REPO              Filter by repo");
      console.error("  --language LANG          Filter by language");
      console.error("  --phase NUM              Filter by CIC phase");
      console.error("  --adapter NAME           Filter by adapter");
      console.error("  --symbols                Search only in symbols");
      console.error("  --functions              Search only in functions");
      console.error("  --imports                Search only in imports");
      console.error("  --exports                Search only in exports");
      console.error("  --todos                  Search only in TODOs");
      console.error("  --per-page NUM           Results per page (default: 20)");
      console.error("");
      console.error("Examples:");
      console.error("  ts-find WarmPoolManager");
      console.error("  ts-find --symbols hydrate");
      console.error("  ts-find --repo cic --phase 27 spawn");
      console.error("  ts-find --imports puppeteer");
      process.exit(1);
    }

    const params = buildSearchParams(opts);
    const url = `${API_URL}/search?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      console.error(`Error: ${response.statusText}`);
      console.error(error);
      process.exit(1);
    }

    const data: any = await response.json();

    if (data.count === 0) {
      console.log("No results found.");
      process.exit(0);
    }

    console.log(`\n🔍 Found ${data.count} result(s) for "${data.query}"\n`);

    for (const result of data.results) {
      console.log(formatResult(result));
      console.log("");
    }
  } catch (err) {
    console.error("Error:", String(err));
    process.exit(1);
  }
}

main();
