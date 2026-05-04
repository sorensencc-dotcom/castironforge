async function loadIndex() {
  const res = await fetch("search-index.json");
  return await res.json();
}

async function init() {
  const index = await loadIndex();
  renderSidebar(index);
}

function renderSidebar(index) {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "<h2>Docs</h2>";

  index.forEach(entry => {
    const item = document.createElement("div");
    item.className = "sidebar-item";
    item.textContent = entry.file.replace(/^.*RewriteLabs\//, "");
    item.onclick = () => loadDocument(entry.file);
    sidebar.appendChild(item);
  });
}

async function loadDocument(path) {
  const res = await fetch(path);
  const text = await res.text();
  document.getElementById("content").innerText = text;
}

init();
