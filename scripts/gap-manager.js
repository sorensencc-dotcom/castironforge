#!/usr/bin/env node
/**
 * CIC GAP Manager v2.1.0
 * High-velocity GAP lifecycle utility:
 *  - Batch artifact generation from batch.json
 *  - Profile-driven configs
 *  - Optional harvest (--harvest)
 *  - Optional synthesis (--synthesize)
 *  - Master Fusion (--fuse)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = '/mnt/c/Users/soren/projects/cic/docs';
const DATA_DIR = '/mnt/c/Users/soren/projects/cic/data';
const PROFILES_DIR = path.join(ROOT, 'profiles');
const REGISTRY_PATH = path.join(DOCS_DIR, 'CIC_NARRATIVE_GAP_REGISTER.md');

// ---------- CLI PARSE ----------

const args = process.argv.slice(2);

if (args.length === 0) {
  usage();
  process.exit(1);
}

const hasFlag = (flag) => args.includes(flag);
const getFlagIndex = (flag) => args.indexOf(flag);

const isSynthesize = hasFlag('--synthesize');
const isHarvest = hasFlag('--harvest');
const isFuse = hasFlag('--fuse');

if (isFuse) {
  runMasterFusion();
  process.exit(0);
}

if (isSynthesize) {
  const idx = getFlagIndex('--synthesize');
  const range = args.slice(idx + 1).filter(a => !a.startsWith('--'));
  if (range.length !== 2) {
    console.error('ERROR: --synthesize requires <start> <end>, e.g. 001 020');
    process.exit(1);
  }
  const [start, end] = range;
  runSynthesis(start, end);
  process.exit(0);
}

// batch mode: node scripts/gap-manager.js batch.json [--harvest]
const batchPath = args.find(a => !a.startsWith('--') && a.endsWith('.json'));
if (!batchPath) {
  console.error('ERROR: Must provide a batch JSON file.');
  usage();
  process.exit(1);
}

const batchAbs = path.resolve(process.cwd(), batchPath);
if (!fs.existsSync(batchAbs)) {
  console.error(`ERROR: Batch file not found: ${batchAbs}`);
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchAbs, 'utf8'));
if (!Array.isArray(batch.gaps)) {
  console.error('ERROR: batch.json must contain "gaps": [ ... ]');
  process.exit(1);
}

// ---------- MAIN: BATCH INITIALIZATION ----------

const initializedGaps = [];

for (const entry of batch.gaps) {
  const { id, profile, intent, theme, timeframe } = entry;
  if (!id || !profile) {
    console.error(`ERROR: Gap entry ${id || 'unknown'} requires "id" and "profile".`);
    process.exit(1);
  }

  const gapId = normalizeGapId(id);
  const profileConfig = loadProfile(profile);

  console.log(`\n[ GAP MANAGER ] Initializing ${gapId} with profile "${profile}"`);

  const goalManifest = buildGoalManifest(gapId, intent, timeframe, profileConfig);
  const auditConfig = buildAuditConfig(gapId, profileConfig);
  const retrievalConfig = buildRetrievalConfig(gapId, profileConfig);
  const missionPack = buildMissionPack(gapId, goalManifest, auditConfig, retrievalConfig);

  writeJson(path.join(DOCS_DIR, `${gapId}_Goal_Manifest.json`), goalManifest);
  writeJson(path.join(DOCS_DIR, `AuditConfig_${gapId}.json`), auditConfig);
  writeJson(path.join(DOCS_DIR, `RetrievalConfig_${gapId}.json`), retrievalConfig);
  writeJson(path.join(DOCS_DIR, `MissionPack_${gapId}.json`), missionPack);

  updateRegistry(gapId, theme || profileConfig.theme, timeframe || profileConfig.timeframe || 'TBD', 'P0', 'PENDING', intent || profileConfig.intent || '');

  initializedGaps.push(gapId);
}

// ---------- OPTIONAL: HARVEST MODE ----------

if (isHarvest && initializedGaps.length > 0) {
  console.log('\n[ GAP MANAGER ] Harvest mode enabled. Running Mission Control for batch...');

  const harvestReport = [];
  for (const gapId of initializedGaps) {
    const result = runMissionControl(gapId);
    harvestReport.push(result);
  }

  const reportPath = path.join(DOCS_DIR, `GAP-BATCH-${timestamp()}-HARVEST-REPORT.md`);
  writeHarvestReport(reportPath, harvestReport);
  console.log(`[ GAP MANAGER ] Harvest report written: ${reportPath}`);
}

console.log('\n✅ [ GAP MANAGER ] Batch initialization complete.');
process.exit(0);

// ---------- HELPERS ----------

function usage() {
  console.log(`
GAP Manager v2.1.0 — Operator-Grade CLI

Usage:
  # Batch init (with profiles)
  node scripts/gap-manager.js batch.json
  node scripts/gap-manager.js batch.json --harvest

  # Synthesis mode
  node scripts/gap-manager.js --synthesize 001 020
  node scripts/gap-manager.js --synthesize S-01 S-17

  # Master Fusion
  node scripts/gap-manager.js --fuse
`);
}

function normalizeGapId(id) {
  if (typeof id === 'string' && (id.startsWith('GAP-') || id.startsWith('S-'))) return id;
  const n = typeof id === 'number' ? id : parseInt(id, 10);
  if (isNaN(n)) return id;
  const padded = String(n).padStart(3, '0');
  return `GAP-${padded}`;
}

function loadProfile(name) {
  const profilePath = path.join(PROFILES_DIR, `${name}.json`);
  if (!fs.existsSync(profilePath)) {
    console.error(`ERROR: Profile not found: ${profilePath}`);
    process.exit(1);
  }
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  if (!profile.audit || !profile.retrieval || !profile.constraints) {
    console.error(`ERROR: Profile "${name}" missing required sections.`);
    process.exit(1);
  }
  return profile;
}

function buildGoalManifest(gapId, intent, timeframe, profile) {
  return {
    goal_id: `cic.harvester_v2.${gapId}`,
    intent: { 
      description: intent || profile.intent || `Fill research gap ${gapId}`, 
      owner: "cic.operator" 
    },
    constraints: { 
      max_cost_usd: profile.constraints.economic_cap || 4.00, 
      security_level: "strict", 
      model_tier: "pro", 
      on_failure: "rollback", 
      max_retries: 3 
    },
    success: { 
      "audit.confidence_min": profile.audit.confidence_min || 0.92, 
      "audit.max_anomalies": 0, 
      "pipeline.status": "clean" 
    }
  };
}

function buildAuditConfig(gapId, profile) {
  return {
    goal_id: `cic.harvester_v2.${gapId}`,
    audit_config: {
      confidence_min: profile.audit.confidence_min,
      max_anomalies: 0,
      temporal_alignment_strict: true,
      contradiction_penalty: profile.audit.contradiction_penalty || 1.30,
      min_primary_sources: profile.audit.primary_sources,
      min_secondary_sources: profile.audit.secondary_sources,
      required_claims: profile.audit.required_claims || [],
      weights: {
        source: { PRIMARY: 1.0, SECONDARY: 0.8, TERTIARY: 0.3, UNKNOWN: 0.1 },
        temporal: { ALIGNED: 1.0, OFF_BY_1_YEAR: 0.5, OFF_BY_2_5_YEARS: 0.2, CONFLICTING: 0.0 }
      }
    }
  };
}

function buildRetrievalConfig(gapId, profile) {
  return {
    goal_id: `cic.harvester_v2.${gapId}`,
    engines: { 
      primary: profile.retrieval.primary_engines[0], 
      secondary: profile.retrieval.secondary_engines[0] 
    },
    fan_out_queries: profile.retrieval.fanout || []
  };
}

function buildMissionPack(gapId, goalManifest, auditConfig, retrievalConfig) {
  return {
    mission_id: gapId,
    goal_id: `cic.harvester_v2.${gapId}`,
    audit: { 
      confidence_min: auditConfig.audit_config.confidence_min, 
      max_anomalies: 0, 
      contradiction_penalty: auditConfig.audit_config.contradiction_penalty, 
      temporal_alignment_strict: true, 
      required_claims: auditConfig.audit_config.required_claims 
    },
    economics: { 
      max_cost_usd: goalManifest.constraints.max_cost_usd, 
      early_stop_reserve: 0.15, 
      min_efficiency: 0.4 
    },
    retrieval: { 
      engine_groups: { 
        industrial_archives: { max_concurrency: 8, retry_policy: "strict" }, 
        news_historical: { max_concurrency: 4, retry_policy: "standard" } 
      } 
    }
  };
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function updateRegistry(gapId, theme, timeframe, priority, status, description) {
  if (!fs.existsSync(REGISTRY_PATH)) return;
  let registry = fs.readFileSync(REGISTRY_PATH, 'utf8');
  
  if (registry.includes(`| ${gapId} |`)) {
    return;
  }
  
  const entry = `| ${gapId} | ${theme} | ${timeframe} | Detroit, MI | ${description} | ${priority} | ${status} |\n`;
  if (registry.includes('## 2. GOAL MATERIALIZATION LOG')) {
    registry = registry.replace('## 2. GOAL MATERIALIZATION LOG', `${entry}\n## 2. GOAL MATERIALIZATION LOG`);
  } else {
    registry += entry;
  }
  
  fs.writeFileSync(REGISTRY_PATH, registry);
}

function runMissionControl(gapId) {
  console.log(`[ GAP MANAGER ] Running Mission Control for ${gapId}...`);
  const res = spawnSync('node', ['scripts/mission-control.js', gapId], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit'
  });

  return {
    gap_id: gapId,
    status: res.status === 0 ? 'OK' : 'ERROR'
  };
}

function writeHarvestReport(p, results) {
  const lines = [];
  lines.push(`# Harvest Report — ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Gap ID | Status |');
  lines.push('|---|---|');
  for (const r of results) {
    lines.push(`| ${r.gap_id} | ${r.status} |`);
  }
  lines.push('');
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

function runSynthesis(start, end) {
  const prefix = start.startsWith('S-') ? 'S-' : 'GAP-';
  const startNum = parseInt(start.replace(/[^0-9]/g, ''), 10);
  const endNum = parseInt(end.replace(/[^0-9]/g, ''), 10);
  
  console.log(`[ SYNTHESIS ] Initiating Synthesis for range ${prefix}${String(startNum).padStart(prefix === 'S-' ? 2 : 3, '0')} to ${prefix}${String(endNum).padStart(prefix === 'S-' ? 2 : 3, '0')}`);

  const reports = [];
  for (let n = startNum; n <= endNum; n++) {
    const gapId = prefix === 'S-' ? `S-${String(n).padStart(2, '0')}` : `GAP-${String(n).padStart(3, '0')}`;
    const reportPath = path.join(DOCS_DIR, `AuditReport_${gapId}_v1.json`);
    if (fs.existsSync(reportPath)) {
      reports.push(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
    }
  }

  if (reports.length === 0) {
    console.warn('[ SYNTHESIS ] No audit reports found in range.');
    return;
  }

  const spine = buildNarrativeSpine(reports);
  const spinePath = path.join(DOCS_DIR, `CIC_NARRATIVE_SPINE_${start}-${end}.md`);
  fs.writeFileSync(spinePath, spine, 'utf8');

  console.log('[ SYNTHESIS ] Complete.');
  console.log(`  Spine:    ${spinePath}`);
}

function runMasterFusion() {
  console.log('[ FUSION ] Initiating Master Fusion (S + 001-030)...');
  
  const allReports = [];
  
  // Load Volume S
  for (let n = 1; n <= 17; n++) {
    const id = `S-${String(n).padStart(2, '0')}`;
    const p = path.join(DOCS_DIR, `AuditReport_${id}_v1.json`);
    if (fs.existsSync(p)) allReports.push(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  
  // Load GAPs 001-030
  for (let n = 1; n <= 30; n++) {
    const id = `GAP-${String(n).padStart(3, '0')}`;
    const p = path.join(DOCS_DIR, `AuditReport_${id}_v1.json`);
    if (fs.existsSync(p)) allReports.push(JSON.parse(fs.readFileSync(p, 'utf8')));
  }

  if (allReports.length === 0) {
    console.error('ERROR: No reports found for fusion.');
    return;
  }

  // Build Master Spine
  const spine = buildMasterSpine(allReports);
  const spinePath = path.join(DOCS_DIR, 'CIC_NARRATIVE_SPINE_S+001-030.md');
  fs.writeFileSync(spinePath, spine, 'utf8');

  // Build Master Timeline (Stub)
  const timeline = { events: allReports.map(r => ({ id: r.header.goal_id.split('.').pop(), confidence: r.summary.conf_goal })) };
  const timelinePath = path.join(DOCS_DIR, 'CIC_TIMELINE_S+001-030.json');
  writeJson(timelinePath, timeline);

  // Build Master Entity Graph (Stub)
  const entities = { nodes: [], edges: [] };
  const entitiesPath = path.join(DOCS_DIR, 'CIC_ENTITY_GRAPH_S+001-030.json');
  writeJson(entitiesPath, entities);

  console.log('[ FUSION ] Complete.');
  console.log(`  Master Spine: ${spinePath}`);
  console.log(`  Timeline:     ${timelinePath}`);
  console.log(`  Entity Graph: ${entitiesPath}`);
}

function buildNarrativeSpine(reports) {
  const lines = [];
  lines.push(`# CIC Narrative Spine (${reports[0].header.goal_id.split('.').pop()} – ${reports.at(-1).header.goal_id.split('.').pop()})`);
  lines.push('');
  lines.push('## Chronological Flow');
  for (const report of reports) {
    const gapId = report.header.goal_id.split('.').pop();
    lines.push(`### ${gapId}`);
    lines.push(`- **Confidence**: ${report.summary.conf_goal}`);
    lines.push(`- **Decision**: ${report.summary.decision}`);
    lines.push('- **Key Findings**:');
    report.findings.slice(0, 3).forEach(f => {
      lines.push(`  - ${f.title} (ce: ${f.ce})`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function buildMasterSpine(reports) {
  const lines = [];
  lines.push('# CIC Master Narrative Spine (S+001–030)');
  lines.push('');
  lines.push('> "One man built all three. You’ve never heard his name."');
  lines.push('');
  lines.push('## Fused Chronological Flow');
  
  reports.forEach(report => {
    const id = report.header.goal_id.split('.').pop();
    lines.push(`### ${id}`);
    lines.push(`- **Confidence**: ${report.summary.conf_goal}`);
    lines.push(`- **Key Findings**:`);
    report.findings.slice(0, 2).forEach(f => {
      lines.push(`  - ${f.title}`);
    });
    lines.push('');
  });
  
  return lines.join('\n');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
