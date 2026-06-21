export interface TagContext {
  repo: string;
  path: string;
  text: string;
  metadata: Record<string, any>;
  explicitPhase?: string;
  explicitAdapter?: string;
}

export interface Tags {
  phase?: string;
  adapter?: string;
  subsystem?: string;
}

export function extractTags(ctx: TagContext): Tags {
  // 1. Explicit caller-provided tags (highest precedence)
  if (ctx.explicitPhase || ctx.explicitAdapter) {
    return {
      phase: ctx.explicitPhase,
      adapter: ctx.explicitAdapter,
      subsystem: inferSubsystemFromPath(ctx.path)
    };
  }

  // 2. Embedded tags inside document text
  const embedded = extractEmbeddedTags(ctx.text);

  // 3. Repo/path heuristics
  const inferred = inferTagsFromPath(ctx.path);

  // 4. Metadata hints (Tika metadata)
  const metaPhase = normalizePhase(ctx.metadata.phase);
  const metaAdapter = normalizeAdapter(ctx.metadata.adapter);

  return {
    phase:
      embedded.phase ??
      inferred.phase ??
      metaPhase ??
      undefined,

    adapter:
      embedded.adapter ??
      inferred.adapter ??
      metaAdapter ??
      undefined,

    subsystem:
      embedded.subsystem ??
      inferred.subsystem ??
      inferSubsystemFromPath(ctx.path)
  };
}

function extractEmbeddedTags(text: string): Tags {
  const phaseMatch = text.match(/@phase-(\d{1,3})/i);
  const adapterMatch = text.match(/@adapter:([A-Za-z0-9_-]+)/i);
  const subsystemMatch = text.match(/@subsystem:([A-Za-z0-9_-]+)/i);

  return {
    phase: phaseMatch?.[1],
    adapter: adapterMatch?.[1],
    subsystem: subsystemMatch?.[1]
  };
}

function inferTagsFromPath(path: string): Tags {
  const parts = path.split("/");

  let phase: string | undefined;
  let adapter: string | undefined;
  let subsystem: string | undefined;

  // phases/27/...
  const phaseIdx = parts.indexOf("phases");
  if (phaseIdx !== -1 && parts[phaseIdx + 1]) {
    const maybePhase = parts[phaseIdx + 1];
    if (/^\d+$/.test(maybePhase)) phase = maybePhase;
  }

  // adapters/warm-pool/...
  const adapterIdx = parts.indexOf("adapters");
  if (adapterIdx !== -1 && parts[adapterIdx + 1]) {
    adapter = normalizeAdapter(parts[adapterIdx + 1]);
  }

  // subsystems/ingestion/...
  const subsystemIdx = parts.indexOf("subsystems");
  if (subsystemIdx !== -1 && parts[subsystemIdx + 1]) {
    subsystem = parts[subsystemIdx + 1];
  }

  return { phase, adapter, subsystem };
}

function normalizePhase(value: any): string | undefined {
  if (!value) return undefined;
  const match = String(value).match(/(\d{1,3})/);
  return match ? match[1] : undefined;
}

function normalizeAdapter(value: any): string | undefined {
  if (!value) return undefined;
  return String(value)
    .replace(/[^A-Za-z0-9_-]/g, "")
    .trim() || undefined;
}

function inferSubsystemFromPath(path: string): string | undefined {
  if (path.includes("ingestion")) return "ingestion";
  if (path.includes("memory")) return "memory";
  if (path.includes("orchestrator")) return "orchestrator";
  if (path.includes("adapters")) return "adapters";
  if (path.includes("planning")) return "planning";
  return undefined;
}
