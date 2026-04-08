const API_KEY = "cae83bb6bc604e7482572ca584a57181";
const API_URL = `https://newsapi.org/v2/everything?q=technology&apiKey=${API_KEY}`;

let allArticles = [];
let searchQuery = "";
let sourceFilter = "all";
let sortMode = "default";

// favorites
let favorites = JSON.parse(localStorage.getItem("tnh_favorites") || "[]");

// pagination
const ARTICLES_PER_PAGE = 9;
let currentPage = 1;

async function fetchNews() {
  const res = await fetch(API_URL);
  const data = await res.json();

  allArticles = data.articles.filter(
    a => a.title && !a.title.includes("[Removed]") && a.url
  );

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
  const pag = document.getElementById("pagination");

  grid.innerHTML = "";
  pag.innerHTML = "";

  const filtered = allArticles
    .filter(a => {
      if (!searchQuery) return true;
      return (a.title + (a.description || "")).toLowerCase().includes(searchQuery);
    })
    .filter(a => sourceFilter === "all" || a.source?.name === sourceFilter)
    .sort((a, b) => {
      if (sortMode === "az") return a.title.localeCompare(b.title);
      if (sortMode === "za") return b.title.localeCompare(a.title);
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });

  const pages = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
  const pageItems = filtered.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  );

  // ✅ UPDATED CARD UI (Commit 10)
  pageItems.forEach(article => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-img-wrap">
        ${
          article.urlToImage
            ? `<img src="${article.urlToImage}" alt="${article.title}" />`
            : ""
        }
      </div>

      <div class="card-body">
        <h2 class="card-title">${article.title}</h2>
        <p class="card-desc">${article.description || ""}</p>
      </div>

      <div class="card-footer">
        <a href="${article.url}" target="_blank">Read more</a>

        <button class="fav-btn" data-url="${article.url}">
          ${favorites.includes(article.url) ? "★" : "☆"}
        </button>
      </div>
    `;

    card.querySelector(".fav-btn").addEventListener("click", (e) => {
      const url = e.target.dataset.url;

      if (favorites.includes(url)) {
        favorites = favorites.filter(u => u !== url);
        e.target.textContent = "☆";
      } else {
        favorites.push(url);
        e.target.textContent = "★";
      }

      localStorage.setItem("tnh_favorites", JSON.stringify(favorites));
    });

    grid.appendChild(card);
  });

  // pagination buttons
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.disabled = i === currentPage;

    btn.addEventListener("click", () => {
      currentPage = i;
      render();
    });

    pag.appendChild(btn);
  }
}

// search
document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(window._searchTimeout);
  window._searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim().toLowerCase();
    currentPage = 1;
    render();
  }, 300);
});

// source filter
document.getElementById("sourceSelect").addEventListener("change", (e) => {
  sourceFilter = e.target.value;
  currentPage = 1;
  render();
});

// sort
document.getElementById("sortSelect").addEventListener("change", (e) => {
  sortMode = e.target.value;
  currentPage = 1;
  render();
});

fetchNews();
