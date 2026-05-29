(function () {
  const renderPanel = () => {
    const releases = window.CIC_RELEASES;
    if (!releases || !releases.length) return;

    const latest = releases[0];

    let panel = document.querySelector('.cic-release-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'cic-release-panel';
      document.body.appendChild(panel);
    }

    panel.innerHTML = `
      <div class="cic-release-panel-header">
        <span class="cic-label">Latest Release</span>
        <span class="cic-release-version">${latest.version}</span>
      </div>
      <div class="cic-release-meta">
        <span class="cic-release-date">${latest.date || ''}</span>
      </div>
      <div class="cic-release-summary">
        ${latest.summary || 'No summary available.'}
      </div>
      <a href="#/${latest.file}" class="cic-release-link">
        View full notes
      </a>
    `;
  };

  document.addEventListener('DOMContentLoaded', () => {
    // wait a bit for indexer to populate window.CIC_RELEASES
    setTimeout(renderPanel, 1200);
  });
})();