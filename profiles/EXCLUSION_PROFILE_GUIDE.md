# CIC Balanced Exclusion Profile System

Operator-grade exclusion specification for autonomous workspace engines and multi-agent indexing pipelines. Tuned for CIC, Antigravity, and TorqueQuery integration.

---

## System Architecture

### 4-Layer Exclusion Model

The system enforces deterministic exclusion across 4 layers:

1. **Dependency Trees** — Exclude `node_modules/`, `vendor/`, `.venv/` while preserving `package.json`, `requirements.txt`
2. **Build Artifacts** — Exclude `dist/`, `build/`, `.next/` while preserving `tsconfig.json`, `next.config.js`
3. **Secrets & Environment** — Exclude `.env`, `*.pem`, `*.key` while preserving `.env.example`, `config/schema.json`
4. **Binary & Non-Text** — Exclude `*.mp4`, `*.sqlite`, `*.db` while preserving `assets/icons/*.svg` (under size caps)

### Components

| Component | File | Role |
|-----------|------|------|
| **Manifest** | `.cicignore` | Unified exclusion rules readable by CIC engines |
| **Engine** | `exclusion-profile-engine.ts` | Auto-detects profile, loads rules, generates specs |
| **Self-Healing** | `self-healing-engine.ts` | Monitors drift, adapts rules, emits healing actions |
| **TorqueQuery Adapter** | `torquequery-adapter.ts` | Converts profiles → TorqueQuery filter rules |
| **Subsystem** | `cic-exclusion-subsystem.ts` | Unified lifecycle, logging, metrics, hooks |
| **Test Suite** | `exclusion-engine.test.ts` | 40+ tests covering all layers and profiles |

---

## Quick Start

### 1. Initialize the Subsystem

```typescript
import { getOrCreateSubsystem } from './profiles/cic-exclusion-subsystem';

const subsystem = await getOrCreateSubsystem({
  rootDir: process.cwd(),
  selfHealingEnabled: true,
  loggingLevel: 'info',
});

subsystem.start();
```

### 2. Get Current Profile

```typescript
const profile = subsystem.getProfile(); // 'fullstack', 'python', 'monorepo', 'ml', 'balanced'
const manifest = subsystem.getManifest(); // Full ExclusionProfile object
```

### 3. Generate TorqueQuery Config

```typescript
const tqConfig = subsystem.generateTorqueQueryConfig();
// {
//   ingestion: {
//     mode: 'balanced',
//     profile: 'fullstack',
//     filters: { exclude: [...], include: [...], language_whitelist: [...] }
//   }
// }
```

### 4. Monitor Healing

```typescript
subsystem.on('drift_detected', (drift) => {
  console.log(`Drift: ${drift.length} changes detected`);
});

subsystem.on('healed', (actions) => {
  console.log(`Applied ${actions.length} healing actions`);
});
```

---

## Profile Detection

The engine auto-detects the workspace profile based on fingerprinting (deterministic, priority-ordered):

### Detection Priority

1. **Monorepo** — `packages/`, `apps/`, `turbo.json`, `lerna.json`, `nx.json`
2. **ML** — `checkpoints/`, `wandb/`, `**/*.pt`
3. **Python** — `requirements.txt`, `pyproject.toml`, `**/*.ipynb`
4. **Fullstack** — `package.json`, `tsconfig.json`, `next.config.js`
5. **Balanced** — Default fallback

### Example: castironforge

```
Repository structure:
  - chat-frontend/      → package.json, tsconfig.json, next.config.js
  - chat-agent/         → package.json, tsconfig.json, Express
  - docker-compose.yml  → Multi-service orchestration

Auto-detection result: fullstack
Reasoning: Presence of package.json + tsconfig.json → JS/TS stack
```

---

## Profile Variants

### Balanced (Default)

- Excludes all 4 layers uniformly
- Suitable for mixed-language codebases
- 500 KB file size cap
- 13+ language types whitelisted

### Fullstack (JS/TS)

Extends balanced with:
- React, Next.js, Vue, Angular specific excludes
- Additional languages: `tsx`, `jsx`, `vue`
- Preserves: `next.config.ts`, `webpack.config.js`, `jest.config.js`

### Python (Data/ML)

Extends balanced with:
- FastAPI, Django, Jupyter specific excludes
- Additional languages: `py`, `ipynb`, `pyx`
- Preserves: `setup.py`, `poetry.lock`, `environment.yml`

### Monorepo

Extends balanced with:
- Workspace-level artifact excludes: `packages/**/node_modules/`
- Preserves: `turbo.json`, `lerna.json`, `pnpm-workspace.yaml`

### ML (PyTorch, TensorFlow)

Extends balanced with:
- ML artifact exclusions: `checkpoints/`, `*.pt`, `*.pth`, `wandb/`
- Preserves: `models/config.json`, `models/model_index.json`

---

## Self-Healing Engine

The self-healing engine continuously monitors workspace drift and auto-adjusts rules.

### Drift Detection

Triggered when:
- **Framework change** — e.g., Next.js → SvelteKit
- **Language addition** — e.g., Rust added to JS monorepo
- **ML artifacts** — e.g., `checkpoints/` or `wandb/` appear
- **Secret addition** — e.g., `.env.production` detected
- **Binary spike** — Binary density > 50% or +20% increase

### Healing Actions

```typescript
export interface HealingAction {
  type: 'exclude' | 'include' | 'profile_switch' | 'size_cap_adjust';
  target: string;
  reason: string;
  timestamp: number;
}
```

Examples:
- **Type: exclude** → Add `*.pt` when ML artifacts detected
- **Type: profile_switch** → Switch to `ml` when `wandb/` appears
- **Type: size_cap_adjust** → Lower to 250KB if binary density > 50%

### Configuration

```typescript
const subsystem = new CicExclusionSubsystem({
  selfHealingEnabled: true,
  selfHealingScanIntervalMs: 10000, // Scan every 10s
  loggingLevel: 'info',
});
```

---

## TorqueQuery Adapter

Converts exclusion profiles into TorqueQuery-compatible filter rules.

### Filter Layers

```
1. Exclude patterns (lowest priority)
2. Language whitelist
3. File size cap
4. Include/Negation patterns (highest priority — override excludes)
```

### Generating Filters

```typescript
import TorqueQueryAdapter from './torquequery-adapter';

const profile = engine.getProfileByName('fullstack');
const adapter = new TorqueQueryAdapter(profile);

// Get filters
const filters = adapter.buildFilters();

// Generate full config
const config = adapter.generateConfig();

// TorqueQuery DSL
const dsl = adapter.toTorqueQueryDSL();

// JSON API format
const json = adapter.toTorqueQueryJSON();
```

### TorqueQuery Integration

```typescript
const tqConfig = adapter.toTorqueQueryJSON();

TorqueQuery.configure({
  mode: 'balanced',
  profile: profile.name,
  filters: tqConfig.ingestion.filters,
});
```

---

## CIC Subsystem Lifecycle

### Events

```typescript
subsystem.on('initialized', (payload) => { /* ... */ });
subsystem.on('started', () => { /* ... */ });
subsystem.on('drift_detected', (drift) => { /* ... */ });
subsystem.on('healed', (actions) => { /* ... */ });
subsystem.on('reloaded', () => { /* ... */ });
subsystem.on('stopped', () => { /* ... */ });
subsystem.on('error', (error) => { /* ... */ });
```

### Lifecycle Hooks

```typescript
// Initialize (load profile, create adapter)
await subsystem.initialize();

// Start (enable self-healing, emit events)
subsystem.start();

// Reload (stop → init → start)
await subsystem.reload();

// Stop (disable self-healing, cleanup)
subsystem.stop();
```

### Metrics

```typescript
const metrics = subsystem.getMetrics();
// {
//   profileDetections: 1,
//   healingActionsApplied: 0,
//   filtersGenerated: 5,
//   validationsPassed: 1,
//   validationsFailed: 0,
//   uptime: 12345,
//   lastUpdateTimestamp: 1718700000000
// }
```

### Diagnostics

```typescript
const diag = subsystem.getDiagnostics();
// {
//   state: { initialized, running, currentProfile, errorCount, ... },
//   metrics: { ... },
//   profile: 'fullstack',
//   validation: { valid: true, errors: [] },
//   healingEngineActive: true
// }
```

---

## Usage Patterns

### Pattern 1: Standalone Engine

```typescript
import ExclusionProfileEngine from './profiles/exclusion-profile-engine';

const engine = new ExclusionProfileEngine('/path/to/workspace');
const profile = engine.detect(); // 'fullstack'
const manifest = engine.getProfileByName(profile);

console.log(manifest.exclude); // Array of patterns
console.log(manifest.include); // Negation rules
```

### Pattern 2: With TorqueQuery

```typescript
import ExclusionProfileEngine from './profiles/exclusion-profile-engine';
import TorqueQueryAdapter from './profiles/torquequery-adapter';

const engine = new ExclusionProfileEngine();
const profile = engine.detect();
const adapter = new TorqueQueryAdapter(engine.getProfileByName(profile));

const config = adapter.toTorqueQueryJSON();
TorqueQuery.configure(config.ingestion);
```

### Pattern 3: Full Subsystem with Events

```typescript
import { getOrCreateSubsystem } from './profiles/cic-exclusion-subsystem';

const subsystem = await getOrCreateSubsystem({ selfHealingEnabled: true });

subsystem.on('drift_detected', async (drift) => {
  console.log(`Drift detected: ${drift[0].description}`);
  // Re-index, update TorqueQuery filters, etc.
});

subsystem.on('healed', (actions) => {
  console.log(`Healing applied: ${actions.map(a => a.target).join(', ')}`);
});

subsystem.start();
```

### Pattern 4: CLI / Testing

```bash
# Detect profile
npx ts-node profiles/exclusion-profile-engine.ts detect
# Output: fullstack

# Load full profile
npx ts-node profiles/exclusion-profile-engine.ts profile
# Output: JSON with all exclusion rules

# Generate CIC spec
npx ts-node profiles/exclusion-profile-engine.ts spec
# Output: CIC-ready JSON spec
```

---

## Testing

Run the test suite:

```bash
npm test -- exclusion-engine.test.ts
```

### Test Coverage

- ✅ All 4-layer exclusion rules (dependencies, build, secrets, binary)
- ✅ Profile detection (fullstack, python, monorepo, ml, balanced)
- ✅ Negation rules (includes override excludes)
- ✅ File size caps
- ✅ Language whitelisting
- ✅ Self-healing drift detection
- ✅ TorqueQuery adapter filter generation
- ✅ End-to-end integration

### Example Test

```typescript
test("should exclude node_modules but include package.json", () => {
  const balanced = engine.getProfileByName("balanced");
  expect(balanced.exclude).toContain("node_modules/");
  expect(balanced.include).toContain("package.json");
});
```

---

## File Structure

```
profiles/
├── .cicignore                          # Unified manifest (gitignore-compatible)
├── exclusion-profile-engine.ts        # Auto-detect + profile loading
├── self-healing-engine.ts             # Drift detection + healing
├── torquequery-adapter.ts             # TorqueQuery filter conversion
├── cic-exclusion-subsystem.ts         # Unified lifecycle + hooks
├── exclusion-engine.test.ts           # 40+ test cases
├── balanced-exclusion-spec.json       # CIC-ready JSON spec
├── exclusion-profiles-index.yaml      # Registry of all profiles
└── EXCLUSION_PROFILE_GUIDE.md         # This document
```

---

## Integration with CIC

### Phase 26 Ingestion

```
CIC Phase 26
  ↓
Load .cicignore → ExclusionProfileEngine.detect()
  ↓
Get profile → TorqueQueryAdapter.buildFilters()
  ↓
Apply filters → TorqueQuery.configure()
  ↓
Index workspace (respecting exclusions)
```

### Phase 27+ (Future)

- **Self-Healing** — Enable `selfHealingEnabled: true` to auto-adapt
- **Drift Monitoring** — Listen to `drift_detected` events
- **Hot-Reload** — Call `subsystem.reload()` to refresh

---

## Error Handling

The subsystem includes agent-safe error boundaries:

```typescript
subsystem.on('error', (error) => {
  const state = subsystem.getState();
  console.log(`Subsystem error count: ${state.errorCount}`);
  console.log(`Last error: ${state.lastError.message}`);

  // Graceful recovery (keep running, emit logs)
  // Critical errors do NOT crash the agent
});
```

---

## Performance Considerations

- **Profile detection** — O(n) directory scan, cached for 1 hour
- **Self-healing scan** — Configurable interval (default 10s)
- **Filter generation** — O(m) where m = number of rules (~50)
- **Memory footprint** — < 5 MB (subsystem + engines)

---

## Next Steps

1. **Integrate with CIC** — Wire `.cicignore` + TorqueQuery adapter into ingestion pipeline
2. **Enable self-healing** — Set `selfHealingEnabled: true` for production
3. **Monitor metrics** — Log `subsystem.getMetrics()` periodically
4. **Test in sandbox** — Validate against castironforge workspace

---

## API Reference

### ExclusionProfileEngine

```typescript
class ExclusionProfileEngine {
  constructor(rootDir?: string)
  detect(): 'fullstack' | 'python' | 'monorepo' | 'ml' | 'balanced'
  loadProfile(): ExclusionProfile
  getProfileByName(name): ExclusionProfile
  getAllProfiles(): Record<string, ExclusionProfile>
  generateCicSpec(): CicSpec
}
```

### SelfHealingEngine

```typescript
class SelfHealingEngine extends EventEmitter {
  constructor(rootDir?: string, scanIntervalMs?: number)
  start(): void
  stop(): void
  forceRescan(): void
  getHealingHistory(): HealingAction[]
  getCurrentSnapshot(): WorkspaceSnapshot | null
  getCurrentManifest(): ExclusionProfile | null
  // Events: 'initialized', 'drift_detected', 'healed', 'started', 'stopped'
}
```

### TorqueQueryAdapter

```typescript
class TorqueQueryAdapter {
  constructor(profile: ExclusionProfile)
  buildFilters(): TorqueQueryFilter[]
  generateConfig(): TorqueQueryConfig
  toTorqueQueryDSL(): string
  toTorqueQueryJSON(): object
  validate(): { valid, errors, warnings }
  generateTestCases(): TestCase[]
}
```

### CicExclusionSubsystem

```typescript
class CicExclusionSubsystem extends EventEmitter {
  constructor(config?: SubsystemConfig)
  async initialize(): Promise<void>
  start(): void
  stop(): void
  async reload(): Promise<void>
  getManifest(): ExclusionProfile | null
  getProfile(): string | null
  generateTorqueQueryConfig(): object
  getMetrics(): SubsystemMetrics
  getState(): SubsystemState
  validate(): ValidationResult
  getDiagnostics(): DiagnosticsReport
  // Events: 'initialized', 'started', 'drift_detected', 'healed', 'reloaded', 'stopped', 'error'
}
```

---

**Last Updated:** 2026-06-18  
**Status:** Production-Ready  
**Maintainer:** CIC Exclusion Profile Engine
