// scripts/warning.js
chrome.storage.session.get("pendingWarning", (result) => {
  const data = result.pendingWarning;
  if (!data) return;

  const { url, score } = data;
  const hostname = new URL(url).hostname;
  const isHighRisk = score >= 0.75;

  document.body.classList.add(isHighRisk ? "state-danger" : "state-warning");

  document.getElementById("warning-title").textContent = isHighRisk
    ? "Dangerous site detected."
    : "Suspicious site detected.";

  document.getElementById("score-display").textContent =
    `${Math.min(Math.round(score * 100), 98)}% Danger Score`;

  document.getElementById("risk-badge").textContent = isHighRisk
    ? "Critical Risk"
    : "Moderate Risk";

  document.getElementById("url-display").textContent = url;

  // increment flagged stat
  chrome.storage.local.get("stats", (result) => {
    const stats = result.stats || { scanned: 0, flagged: 0, whitelisted: 0 };
    stats.flagged = (stats.flagged || 0) + 1;
    chrome.storage.local.set({ stats });
  });

  document.getElementById("btn-back").addEventListener("click", () => {
    chrome.storage.session.remove("pendingWarning");
    history.back();
  });

  document.getElementById("btn-whitelist").addEventListener("click", () => {
    chrome.storage.local.get(["whitelist", "stats"], (result) => {
      const whitelist = result.whitelist || [];
      const stats = result.stats || { scanned: 0, flagged: 0, whitelisted: 0 };

      if (!whitelist.includes(hostname)) {
        whitelist.push(hostname);
        stats.whitelisted = (stats.whitelisted || 0) + 1;
      }

      chrome.storage.local.set({ whitelist, stats }, () => {
        chrome.storage.session.set({ continuing: true }, () => {
          chrome.storage.session.remove("pendingWarning");
          window.location.href = url;
        });
      });
    });
  });

  document.getElementById("btn-continue").addEventListener("click", () => {
    chrome.storage.session.remove("pendingWarning");
    chrome.storage.session.set({ continuing: true }, () => {
      window.location.href = url;
    });
  });
});
