/*
Rewrite Labs — Docs Portal Search UI Implementation
Deterministic, dependency-free, operator-grade.
*/

let SEARCH_INDEX = [];
let ACTIVE_FILTERS = {
  types: new Set(),
  versions: "latest",
  subsystems: new Set(),
  updated: "all"
};

const RESULTS_LIMIT = 50;
let searchInput, resultsPanel, previewPanel, filtersPanel;

async function loadSearchIndex() {
  const res = await fetch("search-index.json");
  SEARCH_INDEX = await res.json();
}

function initSearchUI() {
  searchInput = document.getElementById("search-input");
  resultsPanel = document.getElementById("search-results");
  previewPanel = document.getElementById("search-preview");
  filtersPanel = document.getElementById("search-filters");

  searchInput.addEventListener("input", debounce(handleSearch, 150));
  searchInput.addEventListener("keydown", handleKeyboardNav);

  renderFilters();
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function tokenize(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function scoreEntry(entry, tokens) {
  let score = 0;
  const file = entry.file.toLowerCase();
  const headings = entry.headings.map(h => h.toLowerCase());

  tokens.forEach(token => {
    if (file.includes(token)) score += 40;
    headings.forEach(h => {
      if (h.includes(token)) score += 50;
    });
    if (entry.keywords.includes(token)) score += 20;
  });

  const updated = new Date(entry.last_updated);
  const ageDays = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) score += 10;

  return score;
}

function applyFilters(entry) {
  if (ACTIVE_FILTERS.types.size > 0) {
    const type = entry.file.split("/")[3]?.toLowerCase();
    if (!ACTIVE_FILTERS.types.has(type)) return false;
  }

  if (ACTIVE_FILTERS.updated !== "all") {
    const updated = new Date(entry.last_updated);
    const ageDays = (Date.now() - updated) / (1000 * 60 * 60 * 24);

    if (ACTIVE_FILTERS.updated === "7" && ageDays > 7) return false;
    if (ACTIVE_FILTERS.updated === "30" && ageDays > 30) return false;
    if (ACTIVE_FILTERS.updated === "90" && ageDays > 90) return false;
  }

  return true;
}

function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    resultsPanel.innerHTML = "";
    previewPanel.innerHTML = "";
    return;
  }

  const tokens = tokenize(query);

  const results = SEARCH_INDEX
    .map(entry => ({
      entry,
      score: scoreEntry(entry, tokens)
    }))
    .filter(r => r.score > 0 && applyFilters(r.entry))
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULTS_LIMIT);

  renderResults(results);
}

function renderResults(results) {
  resultsPanel.innerHTML = "";

  if (results.length === 0) {
    resultsPanel.innerHTML = `<div class="no-results">No documents match your search.</div>`;
    return;
  }

  results.forEach(({ entry, score }) => {
    const item = document.createElement("div");
    item.className = "result-item";

    item.innerHTML = `
      <div class="result-title">${entry.file.split("/").pop()}</div>
      <div class="result-path">${entry.file.replace(/^.*RewriteLabs\//, "")}</div>
      <div class="result-updated">Updated: ${new Date(entry.last_updated).toLocaleDateString()}</div>
      <div class="result-snippet">${entry.headings[0] || ""}</div>
    `;

    item.onclick = () => loadPreview(entry.file);

    resultsPanel.appendChild(item);
  });
}

async function loadPreview(path) {
  const res = await fetch(path);
  const text = await res.text();

  const preview = text.split("\n").slice(0, 20).join("\n");

  previewPanel.innerHTML = `
    <div class="preview-title">${path.split("/").pop()}</div>
    <pre class="preview-content">${preview}</pre>
    <button class="open-doc-btn" onclick="openDocument('${path}')">Open Document</button>
  `;
}

async function openDocument(path) {
  const res = await fetch(path);
  const text = await res.text();
  document.getElementById("content").innerText = text;
}

function handleKeyboardNav(e) {
  if (e.key === "Escape") {
    searchInput.value = "";
    resultsPanel.innerHTML = "";
    previewPanel.innerHTML = "";
  }
}

function renderFilters() {
  filtersPanel.innerHTML = `
    <h3>Filters</h3>

    <div class="filter-group">
      <label>Last Updated</label>
      <select id="filter-updated">
        <option value="all">All time</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </select>
    </div>
  `;

  document.getElementById("filter-updated").onchange = e => {
    ACTIVE_FILTERS.updated = e.target.value;
    handleSearch();
  };
}

async function init() {
  await loadSearchIndex();
  initSearchUI();
}

init();
