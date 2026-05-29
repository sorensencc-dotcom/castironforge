(function () {
  const GLOSSARY_PATH = 'cic-glossary.json';

  const loadGlossary = () => fetch(GLOSSARY_PATH).then(r => r.json());

  const walkNodes = (root, cb) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(cb);
  };

  const shouldSkip = (node) => {
    let el = node.parentElement;
    while (el) {
      if (['CODE', 'PRE', 'A'].includes(el.tagName)) return true;
      el = el.parentElement;
    }
    return false;
  };

  const linkGlossaryTerms = (glossary) => {
    const section = document.querySelector('.markdown-section');
    if (!section) return;

    const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
    if (!terms.length) return;

    const pattern = new RegExp('\\b(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');

    walkNodes(section, (textNode) => {
      if (!textNode.nodeValue.trim()) return;
      if (shouldSkip(textNode)) return;

      const original = textNode.nodeValue;
      if (!pattern.test(original)) return;

      const frag = document.createElement('span');
      const replaced = original.replace(pattern, (match) => {
        const href = glossary[match];
        if (!href) return match;
        return `<<<CIC_GLOSSARY_LINK:${match}>>>`;
      });

      const parts = replaced.split(/(<<<CIC_GLOSSARY_LINK:.*?>>)/g);
      parts.forEach(part => {
        const m = part.match(/^<<<CIC_GLOSSARY_LINK:(.*?)>>>$/);
        if (m) {
          const term = m[1];
          const a = document.createElement('a');
          a.href = glossary[term];
          a.className = 'cic-glossary-link cic-pill cic-pill-muted';
          a.textContent = term;
          frag.appendChild(a);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });

      textNode.parentNode.replaceChild(frag, textNode);
    });
  };

  const init = () => {
    loadGlossary().then(linkGlossaryTerms).catch(() => {});
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.$docsify = window.$docsify || {};
    const orig = window.$docsify.doneEach;
    window.$docsify.doneEach = function () {
      if (typeof orig === 'function') orig();
      init();
    };
  });
})();