const API_KEY = "cae83bb6bc604e7482572ca584a57181";
const API_URL = `https://newsapi.org/v2/everything?q=technology&apiKey=${API_KEY}`;

let allArticles = [];

let searchQuery = "";

async function fetchNews() {
  const res = await fetch(API_URL);
  const data = await res.json();

  // Commit 4 fix
  allArticles = data.articles.filter(
    a => a.title && !a.title.includes("[Removed]") && a.url
  );

  render();
}

function render() {
  const grid = document.getElementById("newsGrid");
  grid.innerHTML = "";

  // ✅ UPDATED (filter logic added)
  allArticles
    .filter(a => {
      if (!searchQuery) return true;
      return (a.title + (a.description || "")).toLowerCase().includes(searchQuery);
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

// ✅ NEW (debounce search)
document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(window._searchTimeout);

  window._searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim().toLowerCase();
    render();
  }, 300);
});

fetchNews();
