(function () {
  const extractEndpoints = (text) => {
    const lines = text.split('\n');
    const endpoints = new Set();
    lines.forEach(l => {
      // Look for lines that look like endpoints in the release notes or API docs
      const m = l.match(/^###\s+([A-Z]+)\s+(\S+)/);
      if (m) endpoints.add(`${m[1]} ${m[2]}`);
      
      // Also look for our API template pattern if integrated into release notes
      const m2 = l.match(/^##\s+Endpoint\s*\n+```\n+([A-Z]+)\s+(\S+)/m);
      if (m2) endpoints.add(`${m2[1]} ${m2[2]}`);
    });
    return endpoints;
  };

  const fetchText = (path) => fetch(path).then(r => r.text());

  const renderChanges = async () => {
    const mount = document.getElementById('cic-api-change-detector');
    if (!mount) return;
    const releases = window.CIC_RELEASES;
    if (!releases || releases.length < 2) {
      mount.innerHTML = '<div class="cic-panel">Not enough releases to compute API changes.</div>';
      return;
    }

    const latest = releases[0];
    const prev = releases[1];

    const [latestText, prevText] = await Promise.all([
      fetchText(latest.file),
      fetchText(prev.file)
    ]);

    const latestEndpoints = extractEndpoints(latestText);
    const prevEndpoints = extractEndpoints(prevText);

    const added = [...latestEndpoints].filter(e => !prevEndpoints.has(e));
    const removed = [...prevEndpoints].filter(e => !latestEndpoints.has(e));

    mount.innerHTML = `
      <div class="cic-panel cic-api-change-panel">
        <div class="cic-api-change-header">
          <span class="cic-label">API Change Detector</span>
          <span class="cic-api-change-meta">${latest.version} vs ${prev.version}</span>
        </div>
        <div class="cic-api-change-body">
          <div class="cic-api-change-column">
            <div class="cic-stat-number">${added.length}</div>
            <div class="cic-stat-label">Added</div>
            <ul class="cic-api-change-list">
              ${added.map(e => `<li class="cic-api-added">${e}</li>`).join('') || '<li class="cic-api-none">None</li>'}
            </ul>
          </div>
          <div class="cic-api-change-column">
            <div class="cic-stat-number">${removed.length}</div>
            <div class="cic-stat-label">Removed</div>
            <ul class="cic-api-change-list">
              ${removed.map(e => `<li class="cic-api-removed">${e}</li>`).join('') || '<li class="cic-api-none">None</li>'}
            </ul>
          </div>
        </div>
      </div>
    `;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const wait = () => {
      if (window.CIC_RELEASES) renderChanges();
      else setTimeout(wait, 300);
    };
    wait();
  });
})();