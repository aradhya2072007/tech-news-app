const API_KEY = "cae83bb6bc604e7482572ca584a57181";

const URL = `https://cors-anywhere.herokuapp.com/https://newsapi.org/v2/everything?q=technology&apiKey=${API_KEY}`;

async function fetchNews() {
  const container = document.getElementById("news-container");
  container.innerHTML = "Loading...";
  try {
    const res = await fetch(URL);
    const data = await res.json();

    displayNews(data.articles);
  } catch (error) {
    console.log("Error:", error);
    container.innerHTML = "Error loading news";
  }
}

fetchNews();
function displayNews(articles) {
  const container = document.getElementById("news-container");

  container.innerHTML = "";

  articles.map(article => {
    const card = document.createElement("div");
    card.classList.add("card");

    card.innerHTML = `
      <h3>${article.title}</h3>
      <img src="${article.urlToImage}" width="100%">
      <p>${article.description || "No description"}</p>
      <a href="${article.url}" target="_blank">Read More</a>
    `;

    container.appendChild(card);
  });
}