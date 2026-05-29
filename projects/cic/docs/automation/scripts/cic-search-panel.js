(function () {
  const renderCICResults = (results, query) => {
    const container = document.querySelector('.cic-search-results');
    if (!container) return;

    container.innerHTML = `
      <div class="cic-search-header">
        <span class="cic-label">Search Results</span>
        <span class="cic-search-query">“${query}”</span>
      </div>
    `;

    results.forEach(r => {
      const card = document.createElement('div');
      card.className = 'cic-search-card';
      card.innerHTML = `
        <div class="cic-search-card-title">${r.title}</div>
        <div class="cic-search-card-snippet">${r.content}</div>
        <a href="${r.url}" class="cic-search-card-link">Open</a>
      `;
      container.appendChild(card);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.search input');
    if (!searchInput) return;

    const panel = document.createElement('div');
    panel.className = 'cic-search-results';
    document.body.appendChild(panel);

    searchInput.addEventListener('input', function () {
      const q = this.value.trim();
      if (!q) {
        panel.innerHTML = '';
        return;
      }

      // Docsify search plugin might not be ready or exposed this way depending on version/config
      // But we follow user instruction.
      if (window.$docsify && window.$docsify.search && typeof window.$docsify.search.query === 'function') {
        const results = window.$docsify.search.query(q);
        renderCICResults(results, q);
      }
    });
  });
})();