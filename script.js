"use strict";

// Google News RSS via rss2json — free, no API key, works on all domains
const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnews.google.com%2Frss%2Fsearch%3Fq%3Dtechnology%26hl%3Den-US%26gl%3DUS%26ceid%3DUS%3Aen`;
const ARTICLES_PER_PAGE = 9;

const ls = {
  get: (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  }
};

let allArticles = [];
let favorites = ls.get("tnh_favorites", []);
let searchQuery = "";
let sortMode = "default";
let sourceFilter = "all";
let showSavedOnly = false;
let currentPage = 1;

const splash = document.getElementById("splash");
const splashFill = document.getElementById("splashFill");
const splashLabel = document.getElementById("splashLabel");
const newsGrid = document.getElementById("newsGrid");
const skeletonGrid = document.getElementById("skeletonGrid");
const emptyState = document.getElementById("emptyState");
const pagination = document.getElementById("pagination");
const resultsMeta = document.getElementById("resultsMeta");
const chipsRow = document.getElementById("chipsRow");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const sortSelect = document.getElementById("sortSelect");
const sourceSelect = document.getElementById("sourceSelect");
const savedBtn = document.getElementById("savedBtn");
const savedBadge = document.getElementById("savedBadge");
const headerCount = document.getElementById("headerCount");
const themeBtn = document.getElementById("themeBtn");

const currentTheme = ls.get("tnh_theme", "light");
document.documentElement.dataset.theme = currentTheme;

themeBtn.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  ls.set("tnh_theme", nextTheme);
});

document.getElementById("headerDate").textContent = new Date().toLocaleDateString("en-US", {
  weekday: "short", month: "short", day: "numeric", year: "numeric"
});
document.getElementById("footerYear").textContent = new Date().getFullYear();

function updateSplash(percent, label) {
  if (splashFill) splashFill.style.width = percent + "%";
  if (splashLabel) splashLabel.textContent = label;
}

async function fetchNews() {
  skeletonGrid.classList.remove("hidden");
  newsGrid.classList.add("hidden");

  updateSplash(20, "Connecting to Google News...");

  try {
    updateSplash(50, "Fetching stories...");
    const res = await fetch(API_URL);

    updateSplash(75, "Parsing data...");
    const data = await res.json();

    if (data.status !== "ok" || !Array.isArray(data.items)) {
      throw new Error("Invalid response from news feed");
    }

    // Normalize rss2json items to the shape used by the rest of the app
    allArticles = data.items
      .filter(item => item.title && item.link)
      .map(item => ({
        title: item.title,
        description: item.description
          ? item.description.replace(/<[^>]+>/g, "").trim().slice(0, 200)
          : "",
        url: item.link,
        urlToImage: item.thumbnail || item.enclosure?.link || null,
        publishedAt: item.pubDate,
        source: { name: item.author || "Google News" }
      }));

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
        <p style="margin-bottom:20px;">There was an error loading the latest technology news. Please try again later.</p>
        <button onclick="fetchNews()" style="padding:10px 24px;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Retry</button>
      </div>`;
    }, 1000);
  }
}

function populateSources() {
  const sources = [...new Set(allArticles.map(a => a.source?.name).filter(Boolean))].sort();
  sources.forEach(src => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    sourceSelect.appendChild(opt);
  });
}

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

sortSelect.addEventListener("change", (e) => {
  sortMode = e.target.value;
  currentPage = 1;
  render();
});

sourceSelect.addEventListener("change", (e) => {
  sourceFilter = e.target.value;
  currentPage = 1;
  render();
});

savedBtn.addEventListener("click", () => {
  showSavedOnly = !showSavedOnly;
  savedBtn.classList.toggle("active", showSavedOnly);
  currentPage = 1;
  render();
});

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

  pageItems.forEach((article) => {
    newsGrid.appendChild(buildCard(article));
  });

  renderPagination(pages);
  newsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMeta(total, pages) {
  if (total === 0) {
    resultsMeta.innerHTML = "";
    return;
  }
  const start = (currentPage - 1) * ARTICLES_PER_PAGE + 1;
  const end = Math.min(currentPage * ARTICLES_PER_PAGE, total);
  resultsMeta.innerHTML = `
    <span>${total} stor${total === 1 ? "y" : "ies"} found</span>
    <span>Showing ${start}-${end} · Page ${currentPage} of ${pages}</span>
  `;
}

function renderChips() {
  const activeFilters = [];

  if (searchQuery) {
    activeFilters.push({
      label: `"${searchQuery}"`, clear: () => {
        searchInput.value = ""; searchQuery = ""; searchClear.classList.remove("visible");
      }
    });
  }
  if (sourceFilter !== "all") {
    activeFilters.push({ label: sourceFilter, clear: () => { sourceFilter = "all"; sourceSelect.value = "all"; } });
  }
  if (showSavedOnly) {
    activeFilters.push({ label: "Saved only", clear: () => { showSavedOnly = false; savedBtn.classList.remove("active"); } });
  }
  if (sortMode !== "default") {
    activeFilters.push({ label: sortSelect.options[sortSelect.selectedIndex]?.text, clear: () => { sortMode = "default"; sortSelect.value = "default"; } });
  }

  chipsRow.innerHTML = "";
  activeFilters.forEach(filter => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${filter.label} <button class="chip-x">✕</button>`;
    chip.querySelector(".chip-x").addEventListener("click", () => {
      filter.clear();
      currentPage = 1;
      render();
    });
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

  const imgFallback = '<div style="width:100%;height:100%;background:#e6dac3;display:flex;align-items:center;justify-content:center;color:#8a9a5b;font-size:0.8rem;text-transform:uppercase;">No Image</div>';
  const imgHTML = article.urlToImage
    ? `<img src="${article.urlToImage}" alt="${article.title}" loading="lazy" onerror="this.parentElement.innerHTML='${imgFallback}'">`
    : imgFallback;

  card.innerHTML = `
    <div class="card-img-wrap">
      ${imgHTML}
      <span class="src-badge">${article.source?.name || "Unknown"}</span>
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

  card.querySelector(".fav-btn").addEventListener("click", (e) => {
    toggleFav(article.url, e.currentTarget);
  });

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

  if (showSavedOnly) {
    render();
  }
}

function updateSavedBadge() {
  savedBadge.textContent = favorites.length;
}

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
  let endPage = Math.min(pages, currentPage + 2);

  if (startPage > 1) {
    pagination.appendChild(createPageBtn(1));
    if (startPage > 2) {
      const dots = document.createElement("span");
      dots.className = "pg-dots";
      dots.textContent = "...";
      pagination.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pagination.appendChild(createPageBtn(i));
  }

  if (endPage < pages) {
    if (endPage < pages - 1) {
      const dots = document.createElement("span");
      dots.className = "pg-dots";
      dots.textContent = "...";
      pagination.appendChild(dots);
    }
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
  btn.addEventListener("click", () => {
    currentPage = pageNum;
    render();
  });
  return btn;
}

window.resetAll = () => {
  searchInput.value = "";
  searchQuery = "";
  sortMode = "default";
  sourceFilter = "all";
  showSavedOnly = false;
  currentPage = 1;

  searchClear.classList.remove("visible");
  sortSelect.value = "default";
  sourceSelect.value = "all";
  savedBtn.classList.remove("active");
  render();
};

fetchNews();