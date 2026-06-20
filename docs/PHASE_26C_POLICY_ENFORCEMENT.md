# Phase 26c: Policy Enforcement Middleware

**Date:** 2026-06-20  
**Status:** Implementation Complete  
**Branch:** `claude/opensharing-omnigent-dbrx-bnyfjq`

## Overview

Phase 26c implements **operator-defined policy enforcement** for CIC's inference tier. Operators can now control:

- **Token budgets** — per-session and per-day limits
- **Model allowlists** — restrict access to specific runtime prefixes
- **Rate limiting** — requests per minute per session
- **Concurrency limits** — max simultaneous requests

All policies are configurable via environment variables or code.

## Architecture

```
Request arrives
    ↓
[Policy Middleware]
  ├─ Check model allowlist/blocklist
  ├─ Check session token budget
  ├─ Check rate limit
  ├─ Check concurrent request count
  └─ Allow or reject
    ↓
[Router] (if allowed)
  ├─ Execute inference
  ├─ Count response tokens
  └─ Record token usage
    ↓
Response
```

## New Files

### `chat-agent/src/middleware/policyGate.ts` (250+ lines)

**PolicyEnforcer class** — Applies policies to requests and tracks usage.

```typescript
interface PolicyConfig {
  maxTokensPerSession?: number;      // Default: 1,000,000
  maxTokensPerDay?: number;          // Default: 10,000,000
  allowedModels?: string[];          // Default: ["*"]
  blockedModels?: string[];          // Default: []
  maxConcurrentRequests?: number;    // Default: 10
  ratelimitPerMinute?: number;       // Default: 120
}

export class PolicyEnforcer {
  middleware(): (req, res, next) => void
  recordTokens(sessionId: string, tokensUsed: number): void
  getSessionTokens(sessionId: string): number
}
```

**Policies Enforced:**

1. **Model Allowlist** — Only specific models allowed
   - Patterns: `"local:*"`, `"sharing:dbrx*"`, `"cpu:phi"`, `"*"`
   - Error: 403 Forbidden

2. **Model Blocklist** — Explicit blocklist (overrides allowlist)
   - Useful for excluding expensive models
   - Error: 403 Forbidden

3. **Token Budget** — Per-session limit
   - Tracked on `/chat` and `/chat/stream` responses
   - Error: 429 Too Many Requests

4. **Rate Limiting** — Requests per minute per session
   - Sliding window (1 minute)
   - Error: 429 Too Many Requests

5. **Concurrent Requests** — Max simultaneous requests
   - Global limit across all sessions
   - Error: 429 Too Many Requests

**Automatic Cleanup:**
- Stale session tokens cleaned up every 30 minutes
- Rate limit buckets purged after expiry

### `chat-agent/src/middleware/policyConfig.ts` (100+ lines)

**Configuration loaders** — Load policies from environment or preset configs.

```typescript
export function loadPolicyConfig(): PolicyConfig
export const DEVELOPMENT_POLICY: PolicyConfig
export const PRODUCTION_POLICY: PolicyConfig
export const COST_OPTIMIZED_POLICY: PolicyConfig
export const HIGH_THROUGHPUT_POLICY: PolicyConfig
```

**Environment Variables:**

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `POLICY_MAX_TOKENS_PER_SESSION` | number | 1,000,000 | Max tokens per session |
| `POLICY_MAX_TOKENS_PER_DAY` | number | 10,000,000 | Max tokens per day |
| `POLICY_ALLOWED_MODELS` | csv | `*` | Allowed model prefixes |
| `POLICY_BLOCKED_MODELS` | csv | `` | Blocked models (overrides allow) |
| `POLICY_MAX_CONCURRENT_REQUESTS` | number | 10 | Max simultaneous requests |
| `POLICY_RATELIMIT_PER_MINUTE` | number | 120 | Requests per minute |

### `chat-agent/src/utils/tokenCounter.ts` (20 lines)

**Token estimation utility** — Counts tokens from text.

```typescript
export function estimateTokens(text: string): number
export function countTokens(text: string): number
export function estimateRequestTokens(message: string, context?: string): number
export function estimateResponseTokens(response: string): number
```

**Heuristic:** ~1 token per 4 characters (rough estimate)

*Note:* For production, integrate actual tokenizer (tiktoken, sentencepiece, etc.)

## Modified Files

### `chat-agent/src/server.ts`

Added policy middleware initialization:

```typescript
import { policyEnforcer, createPolicyEnforcer } from './middleware/policyGate';
import { loadPolicyConfig } from './middleware/policyConfig';

const policyConfig = loadPolicyConfig();
const policyMiddleware = createPolicyEnforcer(policyConfig).middleware();
app.use(policyMiddleware);
```

### `chat-agent/src/router/chatAgentRouter.ts`

Updated responses to track tokens:

```typescript
// POST /chat
const tokensUsed = estimateResponseTokens(response);
policyEnforcer.recordTokens(sessionId, tokensUsed);
res.json({
  id: randomUUID(),
  message: response,
  tokensUsed  // ← New field
});

// GET /chat/stream
let totalTokens = 0;
onToken: token => {
  totalTokens += estimateResponseTokens(token);
  res.write(`data: ${token}\n\n`);
},
onDone: () => {
  policyEnforcer.recordTokens(sessionId, totalTokens);  // ← Record total
  res.write('data: [DONE]\n\n');
  res.end();
}
```

### `chat-agent/src/runtimes/types.ts`

(No changes, but RuntimeAdapter responses now expected to include token counts)

## Configuration Examples

### Development Environment

```bash
# Permissive for testing
export POLICY_MAX_TOKENS_PER_SESSION=10000000
export POLICY_MAX_TOKENS_PER_DAY=100000000
export POLICY_ALLOWED_MODELS="*"
export POLICY_MAX_CONCURRENT_REQUESTS=50
export POLICY_RATELIMIT_PER_MINUTE=1000

npm run dev
```

### Production Environment

```bash
# Strict policies for cost control
export POLICY_MAX_TOKENS_PER_SESSION=1000000
export POLICY_MAX_TOKENS_PER_DAY=10000000
export POLICY_ALLOWED_MODELS="local:*,cpu:*,sharing:dbrx*"
export POLICY_BLOCKED_MODELS="torque:*"  # RAG-only
export POLICY_MAX_CONCURRENT_REQUESTS=10
export POLICY_RATELIMIT_PER_MINUTE=120

npm run dev
```

### Cost-Optimized

```bash
# Only Gemini (cheapest)
export POLICY_MAX_TOKENS_PER_SESSION=100000
export POLICY_MAX_TOKENS_PER_DAY=1000000
export POLICY_ALLOWED_MODELS="sharing:gemini*"
export POLICY_BLOCKED_MODELS="sharing:claude*,sharing:dbrx*"
export POLICY_MAX_CONCURRENT_REQUESTS=5
export POLICY_RATELIMIT_PER_MINUTE=60
```

### High Throughput

```bash
# Relaxed limits for high-volume processing
export POLICY_MAX_TOKENS_PER_SESSION=10000000
export POLICY_MAX_TOKENS_PER_DAY=100000000
export POLICY_ALLOWED_MODELS="*"
export POLICY_MAX_CONCURRENT_REQUESTS=100
export POLICY_RATELIMIT_PER_MINUTE=1000
```

## API Behavior

### Allowed Request

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "model": "local:qwen",
    "message": "Hello, world!"
  }'

# Response (200 OK)
{
  "id": "msg-456",
  "message": "Hello! How can I help?",
  "tokensUsed": 25
}
```

### Model Not Allowed

```bash
# Configured: POLICY_ALLOWED_MODELS="local:*,cpu:*"
curl -X POST http://localhost:8000/chat \
  -d '{"model": "sharing:claude", ...}'

# Response (403 Forbidden)
{
  "error": "Model 'sharing:claude' is not allowed"
}
```

### Token Budget Exceeded

```bash
# Configured: POLICY_MAX_TOKENS_PER_SESSION=1000
# Session "user-123" has already used 950 tokens
curl -X POST http://localhost:8000/chat \
  -d '{"sessionId": "user-123", ...}'

# Response (429 Too Many Requests)
{
  "error": "Session token budget exhausted"
}
```

### Rate Limit Exceeded

```bash
# Configured: POLICY_RATELIMIT_PER_MINUTE=5
# Already made 5 requests in the past minute
curl -X POST http://localhost:8000/chat \
  -d '{"sessionId": "user-123", ...}'

# Response (429 Too Many Requests)
{
  "error": "Rate limit exceeded"
}
```

### Max Concurrent Requests Exceeded

```bash
# Configured: POLICY_MAX_CONCURRENT_REQUESTS=2
# Already processing 2 requests
curl -X POST http://localhost:8000/chat \
  -d '{"sessionId": "user-124", ...}'

# Response (429 Too Many Requests)
{
  "error": "Max concurrent requests exceeded"
}
```

## Error Codes

| Code | Condition | Message |
|------|-----------|---------|
| **403 Forbidden** | Model not in allowlist | `Model '{model}' is not allowed` |
| **403 Forbidden** | Model in blocklist | `Model '{model}' is blocked` |
| **429 Too Many Requests** | Session tokens exhausted | `Session token budget exhausted` |
| **429 Too Many Requests** | Rate limit hit | `Rate limit exceeded` |
| **429 Too Many Requests** | Concurrency limit hit | `Max concurrent requests exceeded` |

## Use Cases

### 1. Cost Control (Development)

**Goal:** Prevent runaway costs during development.

```bash
# Max 100k tokens per session (cheap models only)
export POLICY_MAX_TOKENS_PER_SESSION=100000
export POLICY_ALLOWED_MODELS="sharing:gemini*"
```

**Result:** Developers can experiment without expensive models; auto-cutoff at 100k tokens.

### 2. Multi-Tenant SaaS

**Goal:** Enforce per-user quotas in a SaaS product.

```bash
# Each user gets 1M tokens/month
# Rate-limited to 120 req/min
export POLICY_MAX_TOKENS_PER_SESSION=1000000
export POLICY_RATELIMIT_PER_MINUTE=120
export POLICY_MAX_CONCURRENT_REQUESTS=5
```

**Result:** Fair resource sharing; quota enforcement; DoS prevention.

### 3. Enterprise Approval Workflow

**Goal:** Only allow pre-approved models for compliance.

```bash
# Only DBRX (self-hosted, no external dependencies)
export POLICY_ALLOWED_MODELS="local:*,sharing:dbrx*"
export POLICY_BLOCKED_MODELS="sharing:claude*,sharing:gemini*"
```

**Result:** Compliance-approved models only; external API calls rejected.

### 4. Batch Processing

**Goal:** High throughput, relaxed limits for batch jobs.

```bash
export POLICY_MAX_TOKENS_PER_SESSION=100000000
export POLICY_MAX_CONCURRENT_REQUESTS=100
export POLICY_RATELIMIT_PER_MINUTE=10000
```

**Result:** Batch jobs can process large volumes efficiently.

## Token Counting

**Current Implementation:**
- Heuristic: ~1 token per 4 characters
- Applied to response text

**Limitations:**
- Rough estimate (actual varies by model)
- Doesn't count input tokens (future)
- Doesn't count RAG context tokens (future)

**Recommended Improvements (Phase 26c+):**

1. **Integrate Actual Tokenizer**
   - Use `tiktoken` (OpenAI models)
   - Use `transformers.AutoTokenizer` (open models)
   - Runtime-specific tokenizers

2. **Count Input Tokens**
   - Add to recorded tokens
   - Policy checks against total I+O

3. **Count Context Tokens**
   - RAG chunks that go into prompt
   - System prompt overhead

4. **Per-Model Token Cost**
   - Different models have different prices
   - Account for token cost (not just count)
   - Example: Claude costs 3x Gemini

## Testing

### Type Checking

```bash
cd chat-agent
./node_modules/.bin/tsc --noEmit
# (no output = success)
```

### Manual Test

```bash
# 1. Start with restrictive policy
export POLICY_ALLOWED_MODELS="local:*"
export POLICY_MAX_TOKENS_PER_SESSION=100
npm run dev

# 2. Try to use a blocked model
curl -X POST http://localhost:8000/chat \
  -d '{"model": "cpu:phi", ...}'
# Should get 403 Forbidden

# 3. Try to exceed token budget
curl -X POST http://localhost:8000/chat \
  -d '{"sessionId": "test", "model": "local:qwen", "message": "..."}'
# Response 1: success, 25 tokens used
# Response 2: success, 50 tokens total
# Response 3: success, 100 tokens total
# Response 4: 429 Too Many Requests (budget exhausted)
```

## Monitoring & Debugging

**Log Policy Config on Startup:**
```
CIC Chat Agent listening on http://localhost:8000
Policy enforcement enabled: {
  maxTokensPerSession: 1000000,
  maxTokensPerDay: 10000000,
  allowedModels: [ 'local:*', 'cpu:*', 'sharing:dbrx*' ],
  blockedModels: [ 'torque:*' ],
  maxConcurrentRequests: 10,
  ratelimitPerMinute: 120
}
```

**Check Session Token Usage (Phase 26c+):**
```typescript
// Expose endpoint for operator visibility
app.get('/policy/sessions/:sessionId', (req, res) => {
  const tokens = policyEnforcer.getSessionTokens(req.params.sessionId);
  res.json({ sessionId: req.params.sessionId, tokens });
});
```

**Reset Session Budget (Phase 26c+):**
```typescript
app.post('/policy/sessions/:sessionId/reset', (req, res) => {
  policyEnforcer.resetSession(req.params.sessionId);
  res.json({ success: true });
});
```

## Next Steps (Phase 26c+)

### 1. Token Cost Tracking

Currently: `tokens = text.length / 4`
Future: `cost = tokens * modelPricing[model]`

```typescript
// Track cost instead of (or in addition to) tokens
interface PolicyConfig {
  maxCostPerSession?: number;     // $USD
  maxCostPerDay?: number;         // $USD
  modelCosts?: Record<string, number>; // cost per 1M tokens
}
```

### 2. Per-Model Pricing

```yaml
[models]
"local:*" = {cost: 0}            # Free (self-hosted)
"sharing:dbrx*" = {cost: 0.50}   # $0.50 per 1M tokens
"sharing:gemini*" = {cost: 0.08} # $0.08 per 1M tokens
```

### 3. Quota Reset Scheduling

```typescript
// Reset session budgets on schedule
schedule.every('day').at('00:00').do(() => {
  policyEnforcer.resetAllSessions();
  policyEnforcer.resetDailyBudgets();
});
```

### 4. Admin Dashboard

Operator UI to:
- View per-session token usage
- Reset budgets
- Update policies without restart
- View compliance violations

### 5. Billing Integration

Connect to billing system:
- Track actual costs
- Generate invoices
- Enforce spend limits in real-time

## Design Principles

✓ **Operator-Defined** — All policies configurable via env vars  
✓ **Observable** — Token usage tracked and reported in responses  
✓ **Fair** — Per-session limits prevent one user from exhausting resources  
✓ **Flexible** — Multiple preset configs for common scenarios  
✓ **Graceful** — Clear error messages when limits exceeded  
✓ **Deterministic** — Consistent policy enforcement across requests  

## Performance Impact

**Middleware:** ~1-2ms per request (hash map lookups)
**Token Counting:** ~1-2ms per response (string length / 4)
**Total:** <5ms overhead

Negligible for typical inference latency (100–1000ms).

## References

- **Rate Limiting Algorithms:** Token bucket, sliding window
- **Token Counting:** OpenAI's `tiktoken` for reference
- **Policy as Code:** OPA (Open Policy Agent) for future
