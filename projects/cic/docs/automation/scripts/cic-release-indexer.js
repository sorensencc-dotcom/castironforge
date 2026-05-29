(function () {
  const RELEASE_DIR = 'releases/';

  const fetchReleaseFiles = async () => {
    try {
      const res = await fetch(RELEASE_DIR);
      if (!res.ok) return [];
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const links = [...doc.querySelectorAll('a')];

      return links
        .map(a => a.getAttribute('href'))
        .filter(h => h && /^v\d+\.\d+\.\d+\.md$/.test(h))
        .map(h => RELEASE_DIR + h)
        .sort()
        .reverse(); // newest first
    } catch (e) {
      console.error('Failed to fetch release files:', e);
      return [];
    }
  };

  const extractMeta = async (file) => {
    try {
      const res = await fetch(file);
      if (!res.ok) return { file, version: file, date: '', summary: '' };
      const text = await res.text();

      const titleMatch = text.match(/^#\s+(.*)$/m);
      const dateMatch = text.match(/^_Released:\s*(.*)_$/m);
      const summaryMatch = text.match(/^>\s+Summary:\s*(.*)$/m);

      return {
        file,
        version: titleMatch ? titleMatch[1] : file.replace(RELEASE_DIR, '').replace('.md', ''),
        date: dateMatch ? dateMatch[1] : '',
        summary: summaryMatch ? summaryMatch[1] : ''
      };
    } catch (e) {
      return { file, version: file, date: '', summary: '' };
    }
  };

  const buildSidebarSection = async () => {
    const files = await fetchReleaseFiles();
    if (!files.length) return;

    const entries = await Promise.all(files.map(extractMeta));

    const sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;

    const section = document.createElement('ul');
    section.className = 'cic-release-sidebar-section';
    section.innerHTML = `<p class="cic-label">Release Notes</p>`;

    entries.forEach(e => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#/${e.file}">${e.version}</a>`;
      section.appendChild(li);
    });

    sidebar.appendChild(section);

    // expose latest for panel
    window.CIC_RELEASES = entries;
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(buildSidebarSection, 600);
  });
})();