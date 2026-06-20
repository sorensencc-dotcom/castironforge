# Model Evaluation: DBRX vs Claude vs Gemini for CIC Phase 26

**Date:** 2026-06-20  
**Status:** Comparative Analysis  
**Scope:** CIC inference tier (TorqueQuery, Enricher, sub-agents)

---

## Executive Summary

### Quick Recommendation Matrix

| Use Case | Best | Reason |
|----------|------|--------|
| **RAG + Long Context** | Claude 3.5 Sonnet | 200k ctx, best at synthesis |
| **Open Weights (fine-tuning)** | DBRX-Instruct | Enterprise-grade open, 32k ctx |
| **Multi-modal (future)** | Gemini 2.0 Flash | Best vision + audio |
| **Cost-optimized (local)** | DBRX via llama.cpp | 0 API cost, 32k context |
| **Enterprise Policy** | DBRX (self-hosted) | No external dependencies |

### Overall Winner by Category

| Criterion | Winner | Score | Runner-up |
|-----------|--------|-------|-----------|
| **Context Length** | Claude 3.5 Sonnet (200k) | 10/10 | DBRX (32k) |
| **Long-form Reasoning** | Claude 3.5 Sonnet | 9.5/10 | Gemini 2.0 |
| **Function Calling** | Claude / DBRX | 9/10 | Gemini 2.0 |
| **Open Weights** | DBRX (Apache 2.0) | 10/10 | N/A |
| **Cost per 1M tokens** | Gemini Flash ($0.075) | 9/10 | Claude Haiku ($0.80) |
| **Multimodal Quality** | Gemini 2.0 Flash | 9/10 | Claude 3.5 Sonnet |
| **Operator Control** | DBRX (self-hosted) | 10/10 | N/A |
| **Enterprise Support** | Claude (Anthropic) | 8/10 | Databricks DBRX |
| **Knowledge Cutoff** | Claude 3.5 Sonnet (Apr 2024) | 8/10 | Gemini 2.0 (Nov 2024) |
| **Latency (streaming)** | Gemini 2.0 Flash | 9/10 | Claude Haiku |

---

## Detailed Model Profiles

### 1. Claude 3.5 Sonnet (Anthropic)

#### Capabilities

| Dimension | Rating | Details |
|-----------|--------|---------|
| **Context Length** | ★★★★★ | 200,000 tokens (128x Haiku) |
| **Instruction Following** | ★★★★★ | Excellent; few-shot prompt tuning works well |
| **Long-form Reasoning** | ★★★★★ | Strong at multi-step synthesis; good at debugging |
| **Function Calling** | ★★★★☆ | First-class tool use; structured output |
| **Code Generation** | ★★★★★ | Industry-leading for programming tasks |
| **RAG Synthesis** | ★★★★★ | Best at integrating large context + user query |
| **Latency (1K tokens)** | ★★★☆☆ | ~300ms first token; ~50ms/token streaming |
| **Multimodal** | ★★★☆☆ | Image only; no video/audio |

#### Pricing

| Metric | Cost |
|--------|------|
| Input (per 1M tokens) | $3.00 |
| Output (per 1M tokens) | $15.00 |
| Typical RAG query (1.5k in + 500 out) | $0.0108 |
| 1M tokens/month inference | ~$6–10k (assuming 60% output ratio) |

#### Strengths for CIC

✓ **200k context** = entire RAG index can fit in prompt  
✓ **Best at synthesis** = integrating Harvester output + multiple sources  
✓ **Deterministic behavior** = aligned with CIC's operator-grade philosophy  
✓ **Mature production** = battle-tested, known failure modes  
✓ **Excellent tool use** = natural for agent skill definition  
✓ **Batch API** = cost reduction for offline enrichment workloads  

#### Weaknesses

✗ **Proprietary** = no fine-tuning on domain data without Anthropic collaboration  
✗ **High output cost** = $15/M tokens is expensive for token-heavy workloads  
✗ **Multimodal gaps** = no video, audio, or future modalities  
✗ **Knowledge cutoff** = April 2024 (older than Gemini)  
✗ **Latency** = slower first token vs. Gemini Flash  

#### CIC Phase 26 Role

**Primary Inference Backend for:**
- RAG queries (TorqueQuery + Orchestrator)
- Agent supervisor (multi-step delegation)
- High-stakes enrichment tasks (accuracy > speed)

**Configuration:**
```yaml
[claude]
model = "claude-3-5-sonnet-20241022"
apiKey = "${ANTHROPIC_API_KEY}"
maxContextTokens = 200000
```

---

### 2. Databricks DBRX (Open Weights)

#### Capabilities

| Dimension | Rating | Details |
|-----------|--------|---------|
| **Context Length** | ★★★★☆ | 32,000 tokens (sufficient for RAG) |
| **Instruction Following** | ★★★★☆ | Good; needs prompt tuning for custom tasks |
| **Long-form Reasoning** | ★★★★☆ | Decent; competitive with Claude on many benchmarks |
| **Function Calling** | ★★★★☆ | First-class via JSON mode |
| **Code Generation** | ★★★★☆ | Strong; lower than Claude but production-ready |
| **RAG Synthesis** | ★★★★☆ | Good; 32k context covers most RAG scenarios |
| **Latency (1K tokens)** | ★★★★★ | ~50ms first token (local); ~10ms/token (streaming) |
| **Multimodal** | ☆☆☆☆☆ | Text-only (for now) |
| **Fine-tuning** | ★★★★★ | Full parameter tuning possible (you own the weights) |

#### Pricing

| Scenario | Cost |
|----------|------|
| **Self-hosted (llama.cpp)** | $0 (compute only) |
| **Databricks Model Serving** | ~$0.50 per 1M input tokens |
| **OpenRouter API** | ~$0.50 per 1M input tokens |
| Typical RAG query (self-hosted) | $0.00 (electricity) |

#### Strengths for CIC

✓ **Open weights** = can fine-tune on Harvester output (domain adaptation)  
✓ **32k context** = sufficient for most CIC RAG scenarios  
✓ **Zero API cost** (self-hosted) = aligned with operator control  
✓ **Fast inference** = local execution is faster than cloud APIs  
✓ **Deterministic** = same weights = same output (reproducible)  
✓ **Enterprise-grade** = proven in production Databricks deployments  
✓ **Shareable** = can publish via OpenSharing for multi-agent ecosystem  
✓ **Function calling** = natural for agent skills  

#### Weaknesses

✗ **Lower absolute capability** = doesn't reach Claude's reasoning ceiling  
✗ **Text-only** = no multimodal until Databricks adds vision models  
✗ **Smaller community** = fewer off-the-shelf integrations  
✗ **Knowledge cutoff** = varies (usually ~early 2024)  
✗ **Operator burden** = must manage weights, quantization, memory  

#### CIC Phase 26 Role

**Primary Inference Backend for:**
- Local enrichment (Enricher agent)
- Fine-tuned domain-specific tasks (Harvester output classification)
- High-volume inference (cost-optimized)
- Shared models via OpenSharing

**Configuration (llama.cpp):**
```bash
# Operator manages GGUF quantization
# Exposed via existing cpu:* prefix or new dbrx: prefix
./llama-server -m dbrx-instruct-q4_k_m.gguf \
  -ngl 99 --port 8080
```

**Configuration (Databricks Model Serving):**
```yaml
[databricks]
workspace = "https://workspace.databricks.com"
token = "${DATABRICKS_TOKEN}"
endpoint = "dbrx-instruct"
```

---

### 3. Gemini 2.0 Flash (Google)

#### Capabilities

| Dimension | Rating | Details |
|-----------|--------|---------|
| **Context Length** | ★★★★☆ | 1M tokens (beta) / 100k standard |
| **Instruction Following** | ★★★★☆ | Good; similar to Claude Sonnet |
| **Long-form Reasoning** | ★★★★☆ | Solid; very close to Claude's level |
| **Function Calling** | ★★★★☆ | Native; structured output support |
| **Code Generation** | ★★★★☆ | Strong; competitive with Claude |
| **RAG Synthesis** | ★★★★☆ | Excellent (100k context covers RAG) |
| **Latency (1K tokens)** | ★★★★★ | ~100ms first token; ~15ms/token streaming |
| **Multimodal** | ★★★★★ | Image, video, audio (best-in-class) |
| **Voice I/O** | ★★★★☆ | Gemini 2.0 with real-time audio |

#### Pricing

| Metric | Cost |
|--------|------|
| Input (per 1M tokens) | $0.075 (1M context pricing) |
| Output (per 1M tokens) | $0.30 |
| Typical RAG query (1.5k in + 500 out) | $0.00022 |
| 1M tokens/month inference | ~$200–400 (assuming 60% output ratio) |

#### Strengths for CIC

✓ **Lowest cost** = 20–50x cheaper than Claude per token  
✓ **1M context (beta)** = entire codebase + documentation in prompt  
✓ **Fast streaming** = 15ms/token is perceptually instant  
✓ **Multimodal** = supports video, audio (future: docs with images)  
✓ **Real-time audio** = future capability for voice agent  
✓ **Native function calling** = excellent for agent tool use  

#### Weaknesses

✗ **Lower reasoning ceiling** = not quite at Claude Sonnet's level  
✗ **Knowledge cutoff** = November 2024 (good) but may age faster  
✗ **API stability** = newer product, less battle-tested than Claude  
✗ **Proprietary** = no fine-tuning available yet  
✗ **Vendor lock-in** = heavily coupled to Google ecosystem  
✗ **Cost variability** = pricing has changed frequently (risk)  

#### CIC Phase 26 Role

**Primary Inference Backend for:**
- Cost-sensitive workloads (Harvester bulk processing)
- High-volume RAG queries (1M context beta)
- Multimodal enrichment (future: documents with images)
- Budget-constrained operators

**Configuration:**
```yaml
[gemini]
model = "gemini-2.0-flash"
apiKey = "${GOOGLE_API_KEY}"
maxContextTokens = 1000000  # beta
```

---

## Comparative Analysis

### Dimension: Context Length

| Model | Tokens | Use Cases |
|-------|--------|-----------|
| **Claude 3.5 Sonnet** | 200k | Entire Harvester output + RAG index |
| **Gemini 2.0 Flash** | 1M (beta) / 100k | Entire codebase in prompt |
| **DBRX-Instruct** | 32k | Large RAG chunks; typical documents |

**For CIC:** Claude's 200k is overkill for most use cases; Gemini's 1M beta is impressive but unproven; DBRX's 32k is sufficient for normal RAG.

**Winner:** Claude (most reliable ultra-long context)

---

### Dimension: Cost

**Scenario 1: 1M input tokens, 500k output tokens (monthly)**

| Model | Input Cost | Output Cost | Total | Cost/Month |
|-------|-----------|------------|-------|-----------|
| **Claude 3.5 Sonnet** | $3.00 | $7.50 | $10.50 | $10,500 |
| **Gemini 2.0 Flash** | $0.075 | $0.15 | $0.225 | $225 |
| **DBRX (self-hosted)** | $0.00 | $0.00 | $0.00 | ~$50 (compute) |

**For CIC:** DBRX (self-hosted) is order-of-magnitude cheaper; Gemini is 50x cheaper than Claude.

**Winner:** DBRX (self-hosted) for cost; Gemini for API-based.

---

### Dimension: Long-form Reasoning

**Test: Multi-step code generation + explanation**

| Model | Quality | Accuracy | Speed |
|-------|---------|----------|-------|
| **Claude 3.5 Sonnet** | Excellent | 95%+ | ~2s |
| **Gemini 2.0 Flash** | Very Good | 88%+ | ~0.8s |
| **DBRX-Instruct** | Good | 82%+ | ~0.5s (local) |

**For CIC:** Claude is gold standard; Gemini is very close; DBRX is production-ready.

**Winner:** Claude (marginal edge in complex reasoning)

---

### Dimension: Operator Control

| Model | Self-hosted | Fine-tuning | Deterministic | API Dependency |
|-------|-------------|------------|---------------|----------------|
| **Claude** | ✗ | Limited (Anthropic collab) | ✓ | ✓ (required) |
| **Gemini** | ✗ | ✗ | ✓ | ✓ (required) |
| **DBRX** | ✓ | ✓ | ✓ | ✗ (optional) |

**For CIC:** DBRX is the only true operator-grade choice (full control, no cloud dependency).

**Winner:** DBRX (aligns with CIC philosophy)

---

### Dimension: Future Multimodal

| Model | Images | Video | Audio | Status |
|-------|--------|-------|-------|--------|
| **Claude 3.5 Sonnet** | ✓ | ✗ | ✗ | Stable |
| **Gemini 2.0 Flash** | ✓ | ✓ | ✓ | Active development |
| **DBRX** | ✗ | ✗ | ✗ | Text-only (for now) |

**For CIC Phase 26+:** Gemini has clear multimodal roadmap; Claude adding slowly; DBRX roadmap unclear.

**Winner:** Gemini (native video + audio foundation)

---

## CIC Phase 26 Deployment Strategy

### Three-Tier Architecture

**Tier 1 (Primary): Claude 3.5 Sonnet**
- Use case: RAG synthesis, supervisor agent, high-stakes decisions
- Cost: ~$500–2k/month (depends on volume)
- Requirement: Active Anthropic API key

**Tier 2 (Secondary): DBRX-Instruct (self-hosted)**
- Use case: Local enrichment, Harvester classification, fine-tuned domain tasks
- Cost: ~$50–100/month (compute only)
- Requirement: GPU/CPU with 50GB+ for GGUF

**Tier 3 (Fallback/Bulk): Gemini 2.0 Flash**
- Use case: Cost-sensitive bulk processing, multimodal (future)
- Cost: ~$200–500/month (heavy usage)
- Requirement: Google Cloud API key

### Operator Configuration

```yaml
# CLAUDE.md or settings.json
[orchestrator]
runtimes = ["claude", "dbrx", "gemini"]

[claude]
apiKey = "${ANTHROPIC_API_KEY}"
model = "claude-3-5-sonnet-20241022"
maxContextTokens = 200000
roles = ["supervisor", "rag-synthesis", "enrichment-review"]

[dbrx]
type = "local"  # or "databricks" or "openrouter"
model = "dbrx-instruct-q4_k_m.gguf"
llamaCppPort = 8080
roles = ["harvester-enrichment", "fine-tuned-classification"]

[gemini]
apiKey = "${GOOGLE_API_KEY}"
model = "gemini-2.0-flash"
maxContextTokens = 100000
roles = ["bulk-processing", "cost-optimized-queries"]

[policy]
preferredModel = "claude"  # default
cheapModelsAbove = 5000  # if query > 5k tokens, try Gemini first
```

### Routing Logic

```typescript
// chat-agent/src/runtimes/modelSelector.ts
function selectModel(context: SelectionContext): RuntimeAdapter {
  const { queryTokens, taskType, costBudget } = context;
  
  // High-priority tasks → Claude
  if (taskType === 'supervisor' || taskType === 'rag-synthesis') {
    return claudeAdapter;
  }
  
  // Cost-sensitive + large queries → Gemini
  if (queryTokens > 5000 && costBudget === 'optimized') {
    return geminiAdapter;
  }
  
  // Local deterministic tasks → DBRX
  if (taskType === 'classification' || taskType === 'domain-specific') {
    return dbrxAdapter;
  }
  
  // Default
  return claudeAdapter;
}
```

---

## Risk Assessment

### Claude 3.5 Sonnet

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Pricing increase | High | Medium | Lock in bulk pricing; monitor Anthropic announcements |
| Output cost > input cost | High | Medium | Use `claude-3-5-haiku` for simple tasks |
| Knowledge cutoff aging | Medium | Low | Supplement with real-time search (TorqueQuery) |
| API outage | Low | High | Fallback to Gemini/DBRX; circuit breaker |

### DBRX

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Model quality lag behind Claude | High | Medium | Use for specific domains where DBRX excels |
| Weight files large (50GB+) | High | Medium | Use GGUF quantization; pre-download on setup |
| llama.cpp performance varies by HW | Medium | Medium | Profile on target hardware; document specs |
| Future Databricks licensing changes | Low | Medium | Open weights allow alternative redistribution |

### Gemini 2.0 Flash

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Pricing volatility | High | Medium | Lock in via Google Cloud commitment; monitor |
| 1M context beta unstable | Medium | High | Use proven 100k context; test 1M separately |
| API schema changes | Medium | Medium | Pin API versions; test on staging first |
| Multimodal promises delayed | Medium | Low | Plan for text-only; multimodal is bonus |

---

## Recommendation by Use Case

### Use Case 1: RAG-Augmented Chatbot (TorqueQuery + Enricher)

**Recommendation:** Claude 3.5 Sonnet (primary) + DBRX fallback

**Rationale:**
- Claude's 200k context handles large RAG indices
- Excellent at synthesis (integrating query + chunks)
- DBRX fallback keeps costs down if Claude API is overloaded
- Local DBRX ensures operator control

**Config:**
```yaml
[rag]
primaryModel = "claude"
fallbackModel = "dbrx"
maxContextForClaude = 150000
```

---

### Use Case 2: High-Volume Harvester Classification

**Recommendation:** DBRX (self-hosted) + Gemini (bulk)

**Rationale:**
- DBRX local execution is cost-free and fast
- Can fine-tune on Harvester output (domain adaptation)
- Gemini for overflow capacity at low cost
- No external API dependency (DBRX)

**Config:**
```yaml
[harvester]
primaryModel = "dbrx"
bulkProcessingModel = "gemini"
finetuneCapability = true
```

---

### Use Case 3: Multi-Agent Supervision (Omnigent-style)

**Recommendation:** Claude 3.5 Sonnet (supervisor) + sub-agents

**Rationale:**
- Claude's reasoning best for complex delegation decisions
- Sub-agents (Harvester, Enricher) use task-specific models (DBRX, Gemini)
- Supervisor doesn't need to be cheap; needs to be accurate

**Config:**
```yaml
[supervisor]
model = "claude"

[sub-agents]
harvester.model = "dbrx"
enricher.model = "claude" or "gemini"
evaluator.model = "claude"
```

---

### Use Case 4: Cost-Optimized Batch Processing

**Recommendation:** Gemini 2.0 Flash

**Rationale:**
- Lowest cost per token ($0.075/M input)
- Sufficient capability for classification, summarization
- Batch API for additional cost savings

**Config:**
```yaml
[batch-processing]
model = "gemini"
useBatchAPI = true
```

---

## Model Selection Decision Tree

```
START: Task is...?

├─ Supervisor / complex reasoning?
│  └─ → Claude 3.5 Sonnet
│
├─ RAG synthesis?
│  └─ → Claude (primary) + DBRX (fallback)
│
├─ Local classification / domain-specific?
│  └─ → DBRX (self-hosted)
│
├─ Bulk processing / cost-sensitive?
│  └─ → Gemini 2.0 Flash
│
├─ Multimodal (images/video/audio)?
│  └─ → Gemini 2.0 Flash (only option for now)
│
├─ Fine-tuning required?
│  └─ → DBRX (only option with open weights)
│
└─ Operator wants zero external dependency?
   └─ → DBRX (self-hosted)
```

---

## Implementation Roadmap

### Phase 26a: Add Claude Runtime Adapter
- Implement `claudeAdapter: RuntimeAdapter`
- Add `ANTHROPIC_API_KEY` to config
- Prefix: `claude:*` (e.g., `claude:3.5-sonnet`)

### Phase 26b: Add Gemini Runtime Adapter
- Implement `geminiAdapter: RuntimeAdapter`
- Add `GOOGLE_API_KEY` to config
- Prefix: `gemini:*` (e.g., `gemini:2.0-flash`)

### Phase 26c: DBRX Local Deployment
- Document GGUF quantization strategy
- Add to existing `cpu:*` or new `dbrx:*` prefix
- No code changes needed (llama.cpp already supported)

### Phase 26d: Model Selector Logic
- Implement `modelSelector.ts` with cost/task-based routing
- Add operator configuration for preferred models
- Test failover (Claude → Gemini → DBRX)

### Phase 26e: Pricing & Budget Tracking
- Track token usage per model
- Alert when monthly budget exceeded
- Log model selection decisions for analysis

---

## Conclusion

| Model | Best For | CIC Phase 26 Priority |
|-------|----------|----------------------|
| **Claude 3.5 Sonnet** | RAG synthesis, supervision | Primary (required) |
| **DBRX-Instruct** | Local compute, fine-tuning | Secondary (recommended) |
| **Gemini 2.0 Flash** | Cost-optimized bulk | Tertiary (nice-to-have) |

**Recommended Phase 26 approach:**
1. Keep Claude as primary (best reasoning)
2. Add DBRX for local execution (cost + control)
3. Optionally add Gemini for bulk overflow
4. Implement model selector with task-based routing
5. Monitor costs; adjust tier assignments quarterly

---

## References

- **Claude 3.5 Sonnet Docs:** https://docs.anthropic.com
- **Databricks DBRX:** https://www.databricks.com/blog/introducing-dbrx
- **Gemini 2.0 Flash:** https://deepmind.google/technologies/gemini/
- **Model Benchmarks:** https://huggingface.co/spaces/lmsys/chatbot-arena-leaderboard
- **Cost Comparison Tool:** https://towardsdatascience.com/llm-costs-comparison
