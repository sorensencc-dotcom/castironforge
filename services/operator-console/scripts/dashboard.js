/**
 * Operator Console dashboard.
 * Fetches live data from Memory Spine (port 3100) and Mesh Runtime (port 3000).
 * Gracefully degrades when services are unreachable.
 */
'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const MEMORY_SPINE_URL = 'http://localhost:3100';
const REFRESH_INTERVAL = 30_000; // ms

// ── DateTimeService (mirrors services/mesh-runtime/src/datetime.js) ─────────
const dt = (() => {
  const T = globalThis.Temporal ?? null;

  function nowISO() {
    return T ? T.Now.instant().toString() : new Date().toISOString();
  }

  function toUserZone(iso, zone) {
    if (T) return T.Instant.from(iso).toZonedDateTimeISO(zone).toString();
    try {
      const d = new Date(iso);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const get = t => parts.find(p => p.type === t)?.value ?? '00';
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
    } catch {
      return new Date(iso).toISOString();
    }
  }

  function relativeTime(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60)   return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  return { nowISO, toUserZone, relativeTime };
})();

// ── Density toggle ───────────────────────────────────────────────────────────
const pageShell   = document.getElementById('page-shell');
const densityBtns = document.querySelectorAll('.density-btn');

function setDensity(value) {
  pageShell.style.setProperty('--density', value);
  localStorage.setItem('cif-density', value);
  densityBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.density === value)));
}

densityBtns.forEach(btn => {
  btn.addEventListener('click', () => setDensity(btn.dataset.density));
});

// Restore saved preference
setDensity(localStorage.getItem('cif-density') ?? 'comfortable');

// ── Popover positioning helper ───────────────────────────────────────────────
/**
 * Positions a popover element near its trigger button.
 * Falls back to fixed centre-screen on very narrow viewports.
 */
function positionPopover(popoverEl, triggerEl) {
  const tr  = triggerEl.getBoundingClientRect();
  const vw  = document.documentElement.clientWidth;
  const vh  = document.documentElement.clientHeight;

  popoverEl.style.visibility = 'hidden';
  popoverEl.style.display    = 'block';
  const pr = popoverEl.getBoundingClientRect();
  popoverEl.style.display    = '';
  popoverEl.style.visibility = '';

  let top  = tr.bottom + 8;
  let left = tr.left;

  // Flip left if overflowing right edge
  if (left + pr.width > vw - 16) left = vw - pr.width - 16;
  if (left < 16) left = 16;

  // Flip above if overflowing bottom
  if (top + pr.height > vh - 16) top = tr.top - pr.height - 8;
  if (top < 16) top = 16;

  popoverEl.style.top  = `${top}px`;
  popoverEl.style.left = `${left}px`;
}

// Wire all popovertarget triggers with positioning
document.querySelectorAll('[popovertarget]').forEach(btn => {
  const targetId = btn.getAttribute('popovertarget');
  btn.addEventListener('click', () => {
    const target = document.getElementById(targetId);
    if (target && target.hasAttribute('data-popover-open') ||
        target?.matches(':popover-open')) {
      positionPopover(target, btn);
    }
  });
  // For polyfill path: position on the custom toggle event
  const target = document.getElementById(targetId);
  if (target) {
    target.addEventListener('toggle', e => {
      const opened = target.hasAttribute('data-popover-open') ||
                     target.matches?.(':popover-open') ||
                     e.detail?.newState === 'open';
      if (opened) positionPopover(target, btn);
      btn.setAttribute('aria-expanded', String(opened));
    });
  }
});

// ── API fetch helpers ────────────────────────────────────────────────────────
async function fetchJSON(url, options = {}) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(5000), ...options });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function skeleton(text = '…') {
  return `<span class="skeleton">${text}</span>`;
}

// ── Memory Spine section ─────────────────────────────────────────────────────
async function refreshMemorySpine() {
  const statusEl  = document.getElementById('ms-status');
  const versionEl = document.getElementById('ms-active-version');
  const docCountEl = document.getElementById('ms-doc-count');
  const lastEditEl  = document.getElementById('ms-last-edit');
  const prevVersionEl = document.getElementById('ms-previous-version');

  try {
    const data = await fetchJSON(`${MEMORY_SPINE_URL}/v1/memory/admin/status`);

    statusEl?.querySelector('.badge')?.classList.replace('badge--neutral', 'badge--success');
    if (statusEl) statusEl.querySelector('span:last-child').textContent = 'Healthy';

    if (versionEl) versionEl.textContent = data.active_version ?? '—';
    if (docCountEl) docCountEl.textContent = String(data.doc_count ?? '—');

    const sub = document.getElementById('ms-previous-version-sub');
    if (prevVersionEl && sub) {
      prevVersionEl.textContent = data.previous_version ?? 'none';
      if (data.last_edit) sub.textContent = dt.relativeTime(data.last_edit);
    }

    if (lastEditEl && data.last_edit) {
      lastEditEl.textContent = dt.relativeTime(data.last_edit);
      lastEditEl.title = data.last_edit;
    }

    // Populate version-detail popover
    const dl = document.getElementById('version-detail-content');
    if (dl && data) {
      dl.innerHTML = `
        <dt>Active</dt>  <dd>${data.active_version ?? '—'}</dd>
        <dt>Previous</dt><dd>${data.previous_version ?? 'none'}</dd>
        <dt>Docs</dt>    <dd>${data.doc_count ?? '—'}</dd>
        <dt>Last edit</dt><dd title="${data.last_edit ?? ''}">${data.last_edit ? dt.relativeTime(data.last_edit) : '—'}</dd>
      `;
    }
  } catch {
    const badge = statusEl?.querySelector('.badge');
    if (badge) {
      badge.className = 'badge badge--error';
      badge.querySelector('span:last-child').textContent = 'Unreachable';
    }
    if (versionEl)  versionEl.textContent  = '—';
    if (docCountEl) docCountEl.textContent = '—';
    if (lastEditEl)  lastEditEl.textContent  = '—';
  }
}

// ── Agent fleet section ──────────────────────────────────────────────────────
const AGENT_NAMES = [
  'pr_reviewer', 'pr_tester', 'cic_builder', 'failure_triage',
  'repair_planner', 'repair_executor', 'roadmap_harvester',
  'roadmap_synthesizer', 'eval_runner', 'index_rebuilder',
  'roadmap_feeder', 'summarizer',
];

const MODEL_LABELS = {
  'claude-opus-4-8':          'Opus 4.8',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-sonnet-4-6':        'Sonnet 4.6',
};

function agentCardHTML(name, modelId) {
  const label  = MODEL_LABELS[modelId] ?? modelId ?? 'unknown';
  const popoverId = `agent-popover-${name}`;
  return `
    <div class="agent-card" data-agent="${name}">
      <div class="agent-card__info">
        <div class="agent-card__name">${name.replace(/_/g, ' _ ')}</div>
        <div class="agent-card__model">${label}</div>
      </div>
      <button
        class="info-btn"
        popovertarget="${popoverId}"
        popovertargetaction="toggle"
        aria-controls="${popoverId}"
        aria-expanded="false"
        aria-label="Details for ${name}">i</button>
    </div>
    <div id="${popoverId}" popover="auto" class="detail-popover" role="dialog" aria-label="${name} details">
      <h3>${name}</h3>
      <dl>
        <dt>Model</dt><dd>${modelId ?? '—'}</dd>
        <dt>Status</dt><dd><span class="badge badge--neutral"><span class="dot"></span> <span>Unknown</span></span></dd>
      </dl>
    </div>
  `;
}

function renderAgentFleet() {
  const grid = document.getElementById('agent-grid');
  if (!grid) return;

  // Render static cards; model info would come from YAML via a future /v1/agents API
  grid.innerHTML = AGENT_NAMES.map(name => agentCardHTML(name, 'claude-opus-4-8')).join('');

  // Haiku agents
  ['roadmap_feeder', 'summarizer', 'index_rebuilder'].forEach(name => {
    const card = grid.querySelector(`[data-agent="${name}"] .agent-card__model`);
    if (card) card.textContent = MODEL_LABELS['claude-haiku-4-5-20251001'];
  });

  // Re-wire newly rendered popovertargets for the polyfill path
  grid.querySelectorAll('[popovertarget]').forEach(btn => {
    const targetId = btn.getAttribute('popovertarget');
    const target   = document.getElementById(targetId);
    if (!target) return;
    btn.addEventListener('click', () => {
      const opened = target.hasAttribute('data-popover-open') ||
                     target.matches?.(':popover-open');
      if (opened) positionPopover(target, btn);
      btn.setAttribute('aria-expanded', String(opened));
    });
    target.addEventListener('toggle', e => {
      const opened = target.hasAttribute('data-popover-open') ||
                     target.matches?.(':popover-open') ||
                     e.detail?.newState === 'open';
      if (opened) positionPopover(target, btn);
      btn.setAttribute('aria-expanded', String(opened));
    });
  });
}

// ── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('utc-clock');
  if (!el) return;
  const iso = dt.nowISO();
  el.textContent = iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  el.dateTime = iso;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  updateClock();
  setInterval(updateClock, 1000);

  renderAgentFleet();
  await refreshMemorySpine();
  setInterval(refreshMemorySpine, REFRESH_INTERVAL);
}

boot();
