const API_KEY = "...";
const API_URL = `https://newsapi.org/v2/everything?q=technology&apiKey=${API_KEY}`;

let allArticles = [];

async function fetchNews() {
  const res = await fetch(API_URL);
  const data = await res.json();
  allArticles = data.articles;
}

fetchNews();
