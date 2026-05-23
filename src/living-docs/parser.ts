import { promises as fs } from "fs";
import crypto from "crypto";
import {
  LivingDoc,
  LivingDocFile,
  LivingDocSection,
  LivingDocEntityRef,
  LivingDocTimelineEvent
} from "./types.js";

function makeId(seed: string): string {
  const h = crypto.createHash("sha256");
  h.update(seed);
  return h.digest("hex").slice(0, 32);
}

export async function parseLivingDocFile(file: LivingDocFile): Promise<LivingDoc> {
  const content = await fs.readFile(file.absolutePath, "utf8");

  const sections: LivingDocSection[] = [];
  const entities: LivingDocEntityRef[] = [];
  const timeline: LivingDocTimelineEvent[] = [];

  const lines = content.split(/\r?\n/);
  let currentSectionId: string | null = null;
  let currentSectionText: string[] = [];
  let currentHeading = "";
  let currentLevel = 0;
  let order = 0;

  function flushSection() {
    if (!currentSectionId) return;
    const section: LivingDocSection = {
      id: currentSectionId,
      docId: file.id,
      heading: currentHeading,
      level: currentLevel,
      order,
      text: currentSectionText.join("\n").trim()
    };
    sections.push(section);
    currentSectionId = null;
    currentSectionText = [];
    currentHeading = "";
    currentLevel = 0;
  }

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushSection();
      order += 1;
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();
      currentSectionId = makeId(`${file.id}|section|${order}|${heading}`);
      currentHeading = heading;
      currentLevel = level;
      continue;
    }
    currentSectionText.push(line);
  }
  flushSection();

  // Extremely simple heuristics for entities and timeline markers.
  // These are placeholders you can replace with real NLP later.
  let entityOrder = 0;
  let timelineOrder = 0;
  for (const section of sections) {
    const text = section.text;
    const entityMatches = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
    for (const name of entityMatches) {
      entityOrder += 1;
      const ent: LivingDocEntityRef = {
        id: makeId(`${file.id}|entity|${entityOrder}|${name}`),
        docId: file.id,
        sectionId: section.id,
        name,
        type: "person",
        textSpan: name
      };
      entities.push(ent);
    }

    const dateMatches = text.match(/\b(19|20)\d{2}\b/g) || [];
    for (const dt of dateMatches) {
      timelineOrder += 1;
      const ev: LivingDocTimelineEvent = {
        id: makeId(`${file.id}|timeline|${timelineOrder}|${dt}`),
        docId: file.id,
        sectionId: section.id,
        label: `Year ${dt}`,
        dateText: dt,
        order: timelineOrder
      };
      timeline.push(ev);
    }
  }

  const doc: LivingDoc = {
    id: file.id,
    sourceId: file.sourceId,
    kind: file.kind,
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    filename: file.filename,
    ext: file.ext,
    content,
    sections,
    entities,
    timeline
  };

  return doc;
}
