const API_KEY = "cae83bb6bc604e7482572ca584a57181";
const API_URL = `https://newsapi.org/v2/everything?q=technology&apiKey=${API_KEY}`;

let allArticles = [];

async function fetchNews() {
  const res = await fetch(API_URL);
  const data = await res.json();
  allArticles = data.articles.filter(a => a.title && a.url);
  render();
}

function render() {
  const grid = document.getElementById("newsGrid");
  grid.innerHTML = "";
  allArticles.forEach(article => {
    const card = document.createElement("div");
    card.innerHTML = `
      <h2>${article.title}</h2>
      <p>${article.description || ""}</p>
      <a href="${article.url}" target="_blank">Read more</a>
    `;
    grid.appendChild(card);
  });
}

fetchNews();
