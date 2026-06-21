import fs from "fs";

export type RawFileInfo = {
  path: string;
  repo: string;
};

export type ExtractedMetadata = {
  content: string;
  size: number;
  modified: number;
  todos: string[];
  phase?: string;
  adapter?: string;
};

export const extractMetadata = (file: RawFileInfo): ExtractedMetadata => {
  const stat = fs.statSync(file.path);
  const content = fs.readFileSync(file.path, "utf8");

  const todos: string[] = [];
  const lines = content.split("\n");
  let phase: string | undefined;
  let adapter: string | undefined;

  for (const line of lines) {
    if (line.includes("TODO") || line.includes("FIXME")) {
      todos.push(line.trim());
    }
    const phaseMatch = line.match(/Phase\s+(\d+)/i);
    if (phaseMatch) phase = phaseMatch[1];
    const adapterMatch = line.match(/Adapter:\s*([A-Za-z0-9_]+)/i);
    if (adapterMatch) adapter = adapterMatch[1];
  }

  return {
    content,
    size: stat.size,
    modified: Math.floor(stat.mtimeMs / 1000),
    todos,
    phase,
    adapter
  };
};
