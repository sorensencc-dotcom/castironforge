(function () {
  const waitForReleases = (cb) => {
    const check = () => {
      if (window.CIC_RELEASES && window.CIC_RELEASES.length) cb(window.CIC_RELEASES);
      else setTimeout(check, 300);
    };
    check();
  };

  const fetchText = (path) => fetch(path).then(r => r.text());

  // 1) RELEASE TIMELINE (renders into #cic-release-timeline if present)
  const renderTimeline = (releases) => {
    const mount = document.getElementById('cic-release-timeline');
    if (!mount) return;

    mount.innerHTML = `
      <div class="cic-timeline">
        ${releases.map(r => `
          <div class="cic-timeline-item">
            <div class="cic-timeline-node"></div>
            <div class="cic-timeline-content">
              <div class="cic-timeline-version">${r.version}</div>
              <div class="cic-timeline-date">${r.date || ''}</div>
              <div class="cic-timeline-summary">${r.summary || ''}</div>
              <a href="#/${r.file}" class="cic-timeline-link">View notes</a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  // 2) DIFF VIEWER (latest vs previous) — renders into #cic-release-diff
  const renderDiff = async (releases) => {
    const mount = document.getElementById('cic-release-diff');
    if (!mount || releases.length < 2) return;

    const latest = releases[0];
    const prev = releases[1];

    const [latestText, prevText] = await Promise.all([
      fetchText(latest.file),
      fetchText(prev.file)
    ]);

    const latestLines = latestText.split('\n');
    const prevLines = new Set(prevText.split('\n'));

    const rows = latestLines.map(line => {
      if (!line.trim()) return '';
      if (!prevLines.has(line)) {
        return `<div class="cic-diff-line cic-diff-added">+ ${line}</div>`;
      }
      return `<div class="cic-diff-line cic-diff-unchanged">${line}</div>`;
    }).join('');

    mount.innerHTML = `
      <div class="cic-diff-header">
        <span class="cic-label">Diff</span>
        <span class="cic-diff-meta">${latest.version} vs ${prev.version}</span>
      </div>
      <div class="cic-diff-body">
        ${rows}
      </div>
    `;
  };

  // 3) BUNDLE PANEL (summary + diff + link) — renders into #cic-release-bundle
  const renderBundle = async (releases) => {
    const mount = document.getElementById('cic-release-bundle');
    if (!mount || releases.length < 1) return;

    const latest = releases[0];
    const prev = releases[1];

    let diffSnippet = '';
    if (prev) {
      const [latestText, prevText] = await Promise.all([
        fetchText(latest.file),
        fetchText(prev.file)
      ]);
      const latestLines = latestText.split('\n');
      const prevLines = new Set(prevText.split('\n'));
      const added = latestLines.filter(l => l.trim() && !prevLines.has(l));
      diffSnippet = added.slice(0, 5).map(l => `+ ${l}`).join('\n');
    }

    mount.innerHTML = `
      <div class="cic-bundle-panel">
        <div class="cic-bundle-header">
          <span class="cic-label">Release Bundle</span>
          <span class="cic-bundle-version">${latest.version}</span>
        </div>
        <div class="cic-bundle-summary">${latest.summary || ''}</div>
        ${diffSnippet ? `
        <pre class="cic-bundle-diff"><code>${diffSnippet}</code></pre>
        ` : ''}
        <a href="#/${latest.file}" class="cic-bundle-link">Open full release notes</a>
      </div>
    `;
  };

  // 4) RELEASE INTELLIGENCE FEED — renders into #cic-release-feed
  const renderFeed = (releases) => {
    const mount = document.getElementById('cic-release-feed');
    if (!mount) return;

    mount.innerHTML = `
      <div class="cic-feed">
        ${releases.map(r => `
          <div class="cic-feed-item">
            <div class="cic-feed-header">
              <span class="cic-feed-version">${r.version}</span>
              <span class="cic-feed-date">${r.date || ''}</span>
            </div>
            <div class="cic-feed-summary">${r.summary || ''}</div>
            <a href="#/${r.file}" class="cic-feed-link">View release</a>
          </div>
        `).join('')}
      </div>
    `;
  };

  document.addEventListener('DOMContentLoaded', () => {
    waitForReleases((releases) => {
      renderTimeline(releases);
      renderDiff(releases);
      renderBundle(releases);
      renderFeed(releases);
    });
  });
})();