# File: projects/cic/docs/CIC_DATA_CONTRACTS.md

# Path: projects/cic/docs/CIC_DATA_CONTRACTS.md

# Purpose: Formal data contracts for all CIC artifact types

# ============================================================

# CAST IRON CHARLIE — DATA CONTRACTS (v3.0)

# ============================================================

## 1. RAW ARTIFACT

```
RawArtifact {
  id: str
  kind: "document" | "image" | "pdf" | "audio" | "post"
  source_url: str
  content: str | bytes
  metadata: dict
}
```

---

## 2. ENRICHED ARTIFACT

```
EnrichedArtifact {
  id: str
  kind: str
  raw_id: str
  text: str
  entities: Entity[]
  timeline: TimelineEvent[]
  locations: Location[]
  people: Person[]
  reverse_image: ReverseImageResult | None
}
```

---

## 3. DOCUMENT COMPRESSION OUTPUT

```
CompressedDocument {
  id: str
  claims: Claim[]
  entities: Entity[]
  events: Event[]
  summary: str
}
```

---

## 4. IMAGE COMPRESSION OUTPUT

```
CompressedImage {
  id: str
  ocr_text: str
  scene_summary: str
  reverse_image_matches: list
  claims: Claim[]
}
```

---

## 5. TIMELINE COMPRESSION OUTPUT

```
CompressedTimeline {
  id: str
  events: Event[]
}
```

---

## 6. ENTITY CLUSTER COMPRESSION OUTPUT

```
CompressedEntityCluster {
  id: str
  canonical_name: str
  aliases: list[str]
  confidence: float
}
```

---

## 7. CROSS-SOURCE CANONICALIZATION

```
CrossSourceCompressionResponse {
  canonical_claims: Claim[]
  canonical_entities: Entity[]
  canonical_events: Event[]
  signals: {
    agreement_density: float
    contradiction_density: float
    coverage: float
  }
}
```

---

## 8. EVIDENCE PACKET

```
EvidencePacket {
  topic_id: str
  documents: CompressedDocument[]
  images: CompressedImage[]
  timelines: CompressedTimeline[]
  entity_clusters: CompressedEntityCluster[]
  cross_source: CrossSourceCompressionResponse
}
```

---

## 9. SYNTHESIS OUTPUT

```
SynthesisOutput {
  narrative: {
    narrative: str
    sections: list[str]
    confidence: float
  }
  contradictions: {
    contradictions: list
    alignment_score: float
  }
  summary: str
}
```

---

## 10. AUDIT TRACE

```
AuditTrace {
  topic_id: str
  alignment_results: list
  scores: {
    alignment_score: float
    missing_claim_ratio: float
  }
  contradictions: list
  narrative_confidence: float
}
```

---

## 11. ORCHESTRATION DECISION

```
Decision {
  run_synthesis: bool
  run_audit: bool
  signals: dict
}
```

---

# END OF DOCUMENT
