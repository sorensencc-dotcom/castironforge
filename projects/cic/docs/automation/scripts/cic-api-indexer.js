(function () {
  const API_DIR = 'api/';

  const fetchAPIFiles = async () => {
    try {
      const res = await fetch(API_DIR);
      if (!res.ok) return [];
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const links = [...doc.querySelectorAll('a')];

      return links
        .map(a => a.getAttribute('href'))
        .filter(h => h && h.endsWith('.md'))
        .map(h => API_DIR + h);
    } catch (e) {
      console.error('Failed to fetch API files:', e);
      return [];
    }
  };

  const extractTitle = async (file) => {
    try {
      const res = await fetch(file);
      if (!res.ok) return file.replace(API_DIR, '');
      const text = await res.text();
      const match = text.match(/^#\s+(.*)$/m);
      return match ? match[1] : file.replace(API_DIR, '');
    } catch (e) {
      return file.replace(API_DIR, '');
    }
  };

  const buildSidebar = async () => {
    const files = await fetchAPIFiles();
    if (files.length === 0) return;

    const entries = await Promise.all(
      files.map(async f => ({
        file: f,
        title: await extractTitle(f)
      }))
    );

    const sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;

    const section = document.createElement('ul');
    section.innerHTML = `<p class="cic-label">API Reference</p>`;

    entries.forEach(e => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#/${e.file}">${e.title}</a>`;
      section.appendChild(li);
    });

    sidebar.appendChild(section);
  };

  // Wait for Docsify to finish rendering the sidebar
  window.addEventListener('hashchange', () => {
      // Re-run if sidebar might have been re-rendered
  });

  document.addEventListener('DOMContentLoaded', () => {
      // We might need to wait for Docsify 'ready' or similar hook if it's too early
      setTimeout(buildSidebar, 500);
  });
})();