const API_KEY = "cae83bb6bc604e7482572ca584a57181";
const API_URL = `https://newsapi.org/v2/everything?q=technology&apiKey=${API_KEY}`;

let allArticles = [];
let searchQuery = "";

let sourceFilter = "all";
let sortMode = "default";

async function fetchNews() {
  const res = await fetch(API_URL);
  const data = await res.json();

  allArticles = data.articles.filter(
    a => a.title && !a.title.includes("[Removed]") && a.url
  );

  // ✅ populate source dropdown
  const sources = [...new Set(allArticles.map(a => a.source?.name).filter(Boolean))].sort();

  const sourceSelect = document.getElementById("sourceSelect");
  sources.forEach(src => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    sourceSelect.appendChild(opt);
  });

  render();
}

function render() {
  const grid = document.getElementById("newsGrid");
  grid.innerHTML = "";

  allArticles
    // search filter
    .filter(a => {
      if (!searchQuery) return true;
      return (a.title + (a.description || "")).toLowerCase().includes(searchQuery);
    })

    // ✅ source filter
    .filter(a => sourceFilter === "all" || a.source?.name === sourceFilter)

    // ✅ sorting
    .sort((a, b) => {
      if (sortMode === "az") return a.title.localeCompare(b.title);
      if (sortMode === "za") return b.title.localeCompare(a.title);
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    })

    .forEach(article => {
      const card = document.createElement("div");

      card.innerHTML = `
        <h2>${article.title}</h2>
        <p>${article.description || ""}</p>
        <a href="${article.url}" target="_blank">Read more</a>
      `;

      grid.appendChild(card);
    });
}

// search input (debounce)
document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(window._searchTimeout);

  window._searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim().toLowerCase();
    render();
  }, 300);
});

// ✅ source filter listener
document.getElementById("sourceSelect").addEventListener("change", (e) => {
  sourceFilter = e.target.value;
  render();
});

// ✅ sort listener
document.getElementById("sortSelect").addEventListener("change", (e) => {
  sortMode = e.target.value;
  render();
});

fetchNews();
