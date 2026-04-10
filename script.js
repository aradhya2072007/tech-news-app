"use strict";

// ── RSS FEEDS with confirmed image support ──
const RSS_FEEDS = [
  { url: "https://www.wired.com/feed/rss",         name: "Wired" },
  { url: "https://venturebeat.com/feed/",           name: "VentureBeat" },
  { url: "https://techcrunch.com/feed/",            name: "TechCrunch" },
  { url: "https://www.engadget.com/rss.xml",        name: "Engadget" },
];
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const ARTICLES_PER_PAGE = 9;

// ── STORAGE ──
const ls = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  }
};

// ── STATE ──
let allArticles = [];
let favorites   = ls.get("tnh_favorites", []);
let searchQuery = "";
let sortMode    = "default";
let sourceFilter = "all";
let showSavedOnly = false;
let currentPage = 1;

// ── DOM REFS ──
const splash      = document.getElementById("splash");
const splashFill  = document.getElementById("splashFill");
const splashLabel = document.getElementById("splashLabel");
const newsGrid    = document.getElementById("newsGrid");
const skeletonGrid = document.getElementById("skeletonGrid");
const emptyState  = document.getElementById("emptyState");
const pagination  = document.getElementById("pagination");
const resultsMeta = document.getElementById("resultsMeta");
const chipsRow    = document.getElementById("chipsRow");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const sortSelect  = document.getElementById("sortSelect");
const sourceSelect = document.getElementById("sourceSelect");
const savedBtn    = document.getElementById("savedBtn");
const savedBadge  = document.getElementById("savedBadge");
const headerCount = document.getElementById("headerCount");
const themeBtn    = document.getElementById("themeBtn");

// ── THEME ──
document.documentElement.dataset.theme = ls.get("tnh_theme", "light");
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  ls.set("tnh_theme", next);
});

// ── DATE ──
document.getElementById("headerDate").textContent = new Date().toLocaleDateString("en-US", {
  weekday: "short", month: "short", day: "numeric", year: "numeric"
});
document.getElementById("footerYear").textContent = new Date().getFullYear();

// ── SPLASH ──
function updateSplash(percent, label) {
  if (splashFill)  splashFill.style.width = percent + "%";
  if (splashLabel) splashLabel.textContent = label;
}

// ── HELPERS ──
function extractImage(item) {
  // 1. thumbnail field (Wired, Engadget)
  if (item.thumbnail && item.thumbnail.startsWith("http")) return item.thumbnail;
  // 2. enclosure object (VentureBeat)
  if (item.enclosure && item.enclosure.link && item.enclosure.link.startsWith("http")) return item.enclosure.link;
  // 3. first <img> in description/content HTML
  const html = item.content || item.description || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  return null;
}

function normalizeItem(item, sourceName) {
  return {
    title:       item.title || "Untitled",
    description: (item.description || item.content || "")
                   .replace(/<[^>]+>/g, "").trim().slice(0, 200),
    url:         item.link,
    urlToImage:  extractImage(item),
    publishedAt: item.pubDate,
    source:      { name: sourceName }
  };
}

// ── FETCH (parallel multi-feed) ──
async function fetchNews() {
  skeletonGrid.classList.remove("hidden");
  newsGrid.classList.add("hidden");
  updateSplash(10, "Loading tech news...");

  try {
    const results = await Promise.allSettled(
      RSS_FEEDS.map(feed =>
        fetch(RSS2JSON + encodeURIComponent(feed.url))
          .then(r => r.json())
          .then(data => {
            if (data.status !== "ok" || !Array.isArray(data.items)) return [];
            return data.items
              .filter(item => item.title && item.link)
              .map(item => normalizeItem(item, feed.name));
          })
      )
    );

    updateSplash(80, "Sorting stories...");

    // Merge all feeds, sort by date
    allArticles = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

    if (allArticles.length === 0) throw new Error("No articles returned");

    populateSources();
    updateSavedBadge();
    updateSplash(100, "Ready");

    setTimeout(() => {
      splash.classList.add("hidden");
      skeletonGrid.classList.add("hidden");
      newsGrid.classList.remove("hidden");
      render();
    }, 400);

  } catch (error) {
    console.error("Fetch error:", error);
    updateSplash(100, "Error");
    setTimeout(() => {
      splash.classList.add("hidden");
      skeletonGrid.classList.add("hidden");
      newsGrid.classList.remove("hidden");
      newsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;">
        <h3 style="font-size:1.5rem;margin-bottom:10px;color:var(--primary);">Failed to fetch news</h3>
        <p style="margin-bottom:20px;">Please check your connection and try again.</p>
        <button onclick="fetchNews()" style="padding:10px 24px;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Retry</button>
      </div>`;
    }, 800);
  }
}

// ── SOURCES ──
function populateSources() {
  // Remove old dynamic options
  while (sourceSelect.options.length > 1) sourceSelect.remove(1);
  const sources = [...new Set(allArticles.map(a => a.source?.name).filter(Boolean))].sort();
  sources.forEach(src => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    sourceSelect.appendChild(opt);
  });
}

// ── EVENTS ──
let searchTimeout;
searchInput.addEventListener("input", (e) => {
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

sortSelect.addEventListener("change", (e) => { sortMode = e.target.value; currentPage = 1; render(); });
sourceSelect.addEventListener("change", (e) => { sourceFilter = e.target.value; currentPage = 1; render(); });
savedBtn.addEventListener("click", () => {
  showSavedOnly = !showSavedOnly;
  savedBtn.classList.toggle("active", showSavedOnly);
  currentPage = 1;
  render();
});

// ── FILTER & SORT ──
function getFilteredArticles() {
  return allArticles
    .filter(a => {
      if (!searchQuery) return true;
      const text = [a.title, a.description, a.source?.name].map(s => (s || "").toLowerCase()).join(" ");
      return text.includes(searchQuery);
    })
    .filter(a => sourceFilter === "all" || a.source?.name === sourceFilter)
    .filter(a => !showSavedOnly || favorites.includes(a.url))
    .sort((a, b) => {
      if (sortMode === "az") return (a.title || "").localeCompare(b.title || "");
      if (sortMode === "za") return (b.title || "").localeCompare(a.title || "");
      if (sortMode === "favs") {
        const score = url => favorites.includes(url) ? 0 : 1;
        return score(a.url) - score(b.url);
      }
      return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
    });
}

// ── RENDER ──
function render() {
  const filtered = getFilteredArticles();
  const total = filtered.length;
  const pages = Math.ceil(total / ARTICLES_PER_PAGE) || 1;
  if (currentPage > pages) currentPage = pages;

  const start = (currentPage - 1) * ARTICLES_PER_PAGE;
  const pageItems = filtered.slice(start, start + ARTICLES_PER_PAGE);

  headerCount.textContent = `${total} stor${total === 1 ? "y" : "ies"}`;
  renderMeta(total, pages);
  renderChips();

  if (total === 0) {
    newsGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    pagination.innerHTML = "";
    return;
  }

  emptyState.classList.add("hidden");
  newsGrid.innerHTML = "";
  pageItems.forEach(article => newsGrid.appendChild(buildCard(article)));
  renderPagination(pages);
  newsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMeta(total, pages) {
  if (total === 0) { resultsMeta.innerHTML = ""; return; }
  const start = (currentPage - 1) * ARTICLES_PER_PAGE + 1;
  const end = Math.min(currentPage * ARTICLES_PER_PAGE, total);
  resultsMeta.innerHTML = `
    <span>${total} stor${total === 1 ? "y" : "ies"} found</span>
    <span>Showing ${start}-${end} · Page ${currentPage} of ${pages}</span>
  `;
}

function renderChips() {
  const active = [];
  if (searchQuery) active.push({ label: `"${searchQuery}"`, clear: () => { searchInput.value = ""; searchQuery = ""; searchClear.classList.remove("visible"); } });
  if (sourceFilter !== "all") active.push({ label: sourceFilter, clear: () => { sourceFilter = "all"; sourceSelect.value = "all"; } });
  if (showSavedOnly) active.push({ label: "Saved only", clear: () => { showSavedOnly = false; savedBtn.classList.remove("active"); } });
  if (sortMode !== "default") active.push({ label: sortSelect.options[sortSelect.selectedIndex]?.text, clear: () => { sortMode = "default"; sortSelect.value = "default"; } });

  chipsRow.innerHTML = "";
  active.forEach(f => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${f.label} <button class="chip-x">✕</button>`;
    chip.querySelector(".chip-x").addEventListener("click", () => { f.clear(); currentPage = 1; render(); });
    chipsRow.appendChild(chip);
  });
}

function buildCard(article) {
  const card = document.createElement("div");
  card.className = "card";
  const isFav = favorites.includes(article.url);
  const dateStr = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const imgFallback = `<div style="width:100%;height:100%;background:linear-gradient(135deg,#e6dac3,#d4c9b0);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8a9a5b;font-size:2rem;gap:8px;">📰<span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;">${article.source?.name || "News"}</span></div>`;
  const imgHTML = article.urlToImage
    ? `<img src="${article.urlToImage}" alt="${article.title.replace(/"/g,"'")}" loading="lazy" onerror="this.parentElement.innerHTML='${imgFallback.replace(/'/g,"\\'")}';">`
    : imgFallback;

  card.innerHTML = `
    <div class="card-img-wrap">
      ${imgHTML}
      <span class="src-badge">${article.source?.name || "News"}</span>
    </div>
    <div class="card-body">
      <h2 class="card-title">${article.title}</h2>
      <p class="card-desc">${article.description || "No description available for this story."}</p>
    </div>
    <div class="card-footer">
      <span class="card-date">${dateStr}</span>
      <div class="card-actions">
        <a class="read-btn" href="${article.url}" target="_blank" rel="noopener noreferrer">Read Story</a>
        <button class="fav-btn ${isFav ? "active" : ""}" aria-label="Save article">
          ${isFav ? "★" : "☆"}
        </button>
      </div>
    </div>
  `;

  card.querySelector(".fav-btn").addEventListener("click", (e) => toggleFav(article.url, e.currentTarget));
  return card;
}

function toggleFav(url, btn) {
  if (favorites.includes(url)) {
    favorites = favorites.filter(u => u !== url);
    btn.classList.remove("active");
    btn.textContent = "☆";
  } else {
    favorites.push(url);
    btn.classList.add("active");
    btn.textContent = "★";
  }
  ls.set("tnh_favorites", favorites);
  updateSavedBadge();
  if (showSavedOnly) render();
}

function updateSavedBadge() { savedBadge.textContent = favorites.length; }

function renderPagination(pages) {
  pagination.innerHTML = "";
  if (pages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "pg-btn";
  prevBtn.textContent = "← Prev";
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => { currentPage--; render(); });
  pagination.appendChild(prevBtn);

  let startPage = Math.max(1, currentPage - 2);
  let endPage   = Math.min(pages, currentPage + 2);

  if (startPage > 1) {
    pagination.appendChild(createPageBtn(1));
    if (startPage > 2) { const d = document.createElement("span"); d.className = "pg-dots"; d.textContent = "..."; pagination.appendChild(d); }
  }
  for (let i = startPage; i <= endPage; i++) pagination.appendChild(createPageBtn(i));
  if (endPage < pages) {
    if (endPage < pages - 1) { const d = document.createElement("span"); d.className = "pg-dots"; d.textContent = "..."; pagination.appendChild(d); }
    pagination.appendChild(createPageBtn(pages));
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "pg-btn";
  nextBtn.textContent = "Next →";
  nextBtn.disabled = currentPage === pages;
  nextBtn.addEventListener("click", () => { currentPage++; render(); });
  pagination.appendChild(nextBtn);
}

function createPageBtn(pageNum) {
  const btn = document.createElement("button");
  btn.className = `pg-btn ${pageNum === currentPage ? "active" : ""}`;
  btn.textContent = pageNum;
  btn.addEventListener("click", () => { currentPage = pageNum; render(); });
  return btn;
}

window.resetAll = () => {
  searchInput.value = ""; searchQuery = ""; sortMode = "default"; sourceFilter = "all"; showSavedOnly = false; currentPage = 1;
  searchClear.classList.remove("visible"); sortSelect.value = "default"; sourceSelect.value = "all"; savedBtn.classList.remove("active");
  render();
};

fetchNews();