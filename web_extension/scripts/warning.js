chrome.storage.session.get("pendingWarning", (result) => {
  const data = result.pendingWarning;
  if (!data) return;

  const { url, features, score } = data;

  document.getElementById("url-display").textContent = `URL: ${url}`;
  document.getElementById("score-display").textContent =
    `Risk score: ${score.toFixed(3)}`;

  const tbody = document.querySelector("#features-table tbody");
  for (const [key, value] of Object.entries(features)) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${key}</td><td>${value}</td>`;
    tbody.appendChild(row);
  }

  document.getElementById("btn-back").addEventListener("click", () => {
    chrome.storage.session.remove("pendingWarning");
    history.back();
  });

  document.getElementById("btn-continue").addEventListener("click", () => {
    chrome.storage.session.remove("pendingWarning");
    chrome.storage.session.set({ continuing: true }, () => {
      window.location.href = url;
    });
  });
});
