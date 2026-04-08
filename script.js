"use strict";

// ── CONFIG ──
const API_KEY = "cae83bb6bc604e7482572ca584a57181";
const API_URL = "https://newsapi.org/v2/everything?q=technology&apiKey=" + API_KEY;
const ARTICLES_PER_PAGE = 9;

// ── STATE ──
let allArticles  = [];
let favorites    = JSON.parse(localStorage.getItem("tnh_favorites") || "[]");
let searchQuery  = "";
let sortMode     = "default";
let sourceFilter = "all";
let showSavedOnly = false;
let currentPage  = 1;

// ── DOM REFS ──
const splash      = document.getElementById("splash");
const splashFill  = document.getElementById("splashFill");
const splashLabel = document.getElementById("splashLabel");
const newsGrid    = document.getElementById("newsGrid");
const skeletonGrid= document.getElementById("skeletonGrid");
const emptyState  = document.getElementById("emptyState");
const pagination  = document.getElementById("pagination");
const resultsMeta = document.getElementById("resultsMeta");
const chipsRow    = document.getElementById("chipsRow");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const sortSelect  = document.getElementById("sortSelect");
const sourceSelect= document.getElementById("sourceSelect");
const savedBtn    = document.getElementById("savedBtn");
const savedBadge  = document.getElementById("savedBadge");
const headerCount = document.getElementById("headerCount");
const themeBtn    = document.getElementById("themeBtn");

// ── THEME ──
const savedTheme = localStorage.getItem("tnh_theme") || "dark";
document.documentElement.dataset.theme = savedTheme;

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("tnh_theme", next);
});

// ── DATE ──
const today = new Date();
document.getElementById("headerDate").textContent = today.toLocaleDateString("en-US", {
  weekday: "short", month: "short", day: "numeric", year: "numeric"
});
document.getElementById("footerYear").textContent = today.getFullYear();

// ── SPLASH ──
function updateSplash(percent, label) {
  splashFill.style.width = percent + "%";
  splashLabel.textContent = label;
}

// ── FETCH ──
async function fetchNews() {
  skeletonGrid.classList.remove("hidden");
  newsGrid.classList.add("hidden");
  updateSplash(20, "Connecting to NewsAPI...");

  try {
    updateSplash(50, "Fetching stories...");
    const res  = await fetch(API_URL);
    updateSplash(75, "Parsing data...");
    const data = await res.json();

    // ✅ HOF: filter out removed/invalid articles
    allArticles = data.articles.filter(
      a => a.title && a.url && !a.title.includes("[Removed]")
    );

    populateSources();
    updateSavedBadge();
    updateSplash(100, "Ready");

    setTimeout(() => {
      splash.classList.add("hidden");
      skeletonGrid.classList.add("hidden");
      newsGrid.classList.remove("hidden");
      render();
    }, 400);

  } catch (err) {
    console.error("Fetch error:", err);
    updateSplash(100, "Failed to load");
    setTimeout(() => {
      splash.classList.add("hidden");
      skeletonGrid.classList.add("hidden");
      newsGrid.classList.remove("hidden");
      newsGrid.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:60px;">' +
        '<h3 style="font-size:1.4rem;margin-bottom:10px;color:var(--accent)">Failed to fetch news</h3>' +
        '<p style="color:var(--text-muted)">Check your API key or try again later.</p></div>';
    }, 800);
  }
}

// ── POPULATE SOURCE DROPDOWN ──
function populateSources() {
  // ✅ HOF: map to source names → filter unique → sort
  const sources = allArticles
    .map(a => a.source?.name)
    .filter((name, idx, arr) => name && arr.indexOf(name) === idx)
    .sort();

  // ✅ HOF: map to <option> elements
  sources.map(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    return opt;
  }).forEach(opt => sourceSelect.appendChild(opt));
}

// ── SEARCH ──
let searchTimeout;
searchInput.addEventListener("input", e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim().toLowerCase();
    searchClear.classList.toggle("visible", searchQuery.length > 0);
    currentPage = 1;
    render();
  }, 300);
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchQuery = "";
  searchClear.classList.remove("visible");
  currentPage = 1;
  render();
});

// ── SORT / FILTER / SAVED ──
sortSelect.addEventListener("change",   e => { sortMode     = e.target.value; currentPage = 1; render(); });
sourceSelect.addEventListener("change", e => { sourceFilter = e.target.value; currentPage = 1; render(); });

savedBtn.addEventListener("click", () => {
  showSavedOnly = !showSavedOnly;
  savedBtn.classList.toggle("active", showSavedOnly);
  currentPage = 1;
  render();
});

// ── GET FILTERED + SORTED ARTICLES  (✅ ALL HOFs, no for/while) ──
function getFilteredArticles() {
  // ✅ HOF: filter — search
  const bySearch = allArticles.filter(a => {
    if (!searchQuery) return true;
    const text = `${a.title || ""} ${a.description || ""} ${a.source?.name || ""}`.toLowerCase();
    return text.includes(searchQuery);
  });

  // ✅ HOF: filter — source
  const bySource = bySearch.filter(a =>
    sourceFilter === "all" || (a.source?.name === sourceFilter)
  );

  // ✅ HOF: filter — saved only
  const bySaved = bySource.filter(a =>
    !showSavedOnly || favorites.includes(a.url)
  );

  // ✅ HOF: sort
  return [...bySaved].sort((a, b) => {
    if (sortMode === "az") return (a.title || "").localeCompare(b.title || "");
    if (sortMode === "za") return (b.title || "").localeCompare(a.title || "");
    if (sortMode === "favs") {
      return (favorites.includes(a.url) ? 0 : 1) - (favorites.includes(b.url) ? 0 : 1);
    }
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });
}

// ── RENDER ──
function render() {
  const filtered = getFilteredArticles();
  const total    = filtered.length;
  const pages    = Math.max(1, Math.ceil(total / ARTICLES_PER_PAGE));

  if (currentPage > pages) currentPage = pages;

  const pageItems = filtered.slice(
    (currentPage - 1) * ARTICLES_PER_PAGE,
    currentPage * ARTICLES_PER_PAGE
  );

  headerCount.textContent = `${total} ${total === 1 ? "story" : "stories"}`;
  renderMeta(total, pages);
  renderChips();

  if (total === 0) {
    newsGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    pagination.innerHTML = "";
    return;
  }

  emptyState.classList.add("hidden");

  // ✅ HOF: map articles to card elements
  newsGrid.innerHTML = "";
  pageItems.map(buildCard).forEach(card => newsGrid.appendChild(card));

  renderPagination(pages);
}

function renderMeta(total, pages) {
  if (total === 0) { resultsMeta.innerHTML = ""; return; }
  const start = (currentPage - 1) * ARTICLES_PER_PAGE + 1;
  const end   = Math.min(currentPage * ARTICLES_PER_PAGE, total);
  resultsMeta.innerHTML =
    `<span>${total} stories found</span>` +
    `<span>Showing ${start}–${end} · Page ${currentPage} of ${pages}</span>`;
}

// ── CHIPS ──
function renderChips() {
  // ✅ HOF: build chip configs array, then map to DOM elements
  const chipDefs = [
    searchQuery && {
      label: `"${searchQuery}"`,
      clear() { searchInput.value = ""; searchQuery = ""; searchClear.classList.remove("visible"); }
    },
    sourceFilter !== "all" && {
      label: sourceFilter,
      clear() { sourceFilter = "all"; sourceSelect.value = "all"; }
    },
    showSavedOnly && {
      label: "Saved only",
      clear() { showSavedOnly = false; savedBtn.classList.remove("active"); }
    },
    sortMode !== "default" && {
      label: sortSelect.options[sortSelect.selectedIndex].text,
      clear() { sortMode = "default"; sortSelect.value = "default"; }
    }
  ].filter(Boolean);

  chipsRow.innerHTML = "";
  chipDefs.map(def => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${def.label} <button class="chip-x">✕</button>`;
    chip.querySelector(".chip-x").addEventListener("click", () => {
      def.clear();
      currentPage = 1;
      render();
    });
    return chip;
  }).forEach(chip => chipsRow.appendChild(chip));
}

// ── BUILD CARD ──
function buildCard(article) {
  const card   = document.createElement("div");
  card.className = "card";

  const isFav  = favorites.includes(article.url);
  const src    = article.source?.name || "Unknown";
  const desc   = article.description || "No description available.";
  const dateStr= article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
    : "";

  const imgHTML = article.urlToImage
    ? `<img src="${article.urlToImage}" alt="${article.title}" loading="lazy">`
    : `<div class="card-no-img">No Image</div>`;

  card.innerHTML = `
    <div class="card-img-wrap">
      ${imgHTML}
      <span class="src-badge">${src}</span>
    </div>
    <div class="card-body">
      <h2 class="card-title">${article.title}</h2>
      <p class="card-desc">${desc}</p>
    </div>
    <div class="card-footer">
      <span class="card-date">${dateStr}</span>
      <div class="card-actions">
        <a class="read-btn" href="${article.url}" target="_blank" rel="noopener">Read Story</a>
        <button class="fav-btn ${isFav ? "active" : ""}">${isFav ? "★" : "☆"}</button>
      </div>
    </div>`;

  card.querySelector(".fav-btn").addEventListener("click", e => toggleFav(article.url, e.currentTarget));
  return card;
}

// ── TOGGLE FAV ──
function toggleFav(url, btn) {
  // ✅ HOF: filter to remove, or spread+push to add
  if (favorites.includes(url)) {
    favorites = favorites.filter(u => u !== url);
    btn.classList.remove("active");
    btn.textContent = "☆";
  } else {
    favorites = [...favorites, url];
    btn.classList.add("active");
    btn.textContent = "★";
  }
  localStorage.setItem("tnh_favorites", JSON.stringify(favorites));
  updateSavedBadge();
  if (showSavedOnly) render();
}

function updateSavedBadge() { savedBadge.textContent = favorites.length; }

// ── PAGINATION ──
function renderPagination(pages) {
  pagination.innerHTML = "";
  if (pages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "pg-btn";
  prevBtn.textContent = "← Prev";
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => { currentPage--; render(); });
  pagination.appendChild(prevBtn);

  // ✅ HOF: Array.from + map to create page buttons
  Array.from({ length: pages }, (_, i) => i + 1)
    .map(n => {
      const btn = document.createElement("button");
      btn.className = `pg-btn${n === currentPage ? " active" : ""}`;
      btn.textContent = n;
      btn.addEventListener("click", () => { currentPage = n; render(); });
      return btn;
    })
    .forEach(btn => pagination.appendChild(btn));

  const nextBtn = document.createElement("button");
  nextBtn.className = "pg-btn";
  nextBtn.textContent = "Next →";
  nextBtn.disabled = currentPage === pages;
  nextBtn.addEventListener("click", () => { currentPage++; render(); });
  pagination.appendChild(nextBtn);
}

// ── RESET ALL ──
window.resetAll = function () {
  searchInput.value = "";
  searchQuery   = "";
  sortMode      = "default";
  sourceFilter  = "all";
  showSavedOnly = false;
  currentPage   = 1;
  searchClear.classList.remove("visible");
  sortSelect.value   = "default";
  sourceSelect.value = "all";
  savedBtn.classList.remove("active");
  render();
};

// ── INIT ──
fetchNews();
