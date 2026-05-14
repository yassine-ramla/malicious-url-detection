// scripts/popup.js
function renderWhitelist(whitelist) {
  const list = document.getElementById("whitelist-list");
  const empty = document.getElementById("whitelist-empty");

  list.innerHTML = "";

  if (whitelist.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  for (const hostname of whitelist) {
    const li = document.createElement("li");
    li.className = "whitelist-item";
    li.innerHTML = `
      <span class="whitelist-hostname">${hostname}</span>
      <button class="btn-remove" data-hostname="${hostname}" title="Remove">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hostname = btn.dataset.hostname;
      chrome.storage.local.get("whitelist", (result) => {
        const updated = (result.whitelist || []).filter((h) => h !== hostname);
        chrome.storage.local.set({ whitelist: updated }, () => {
          renderWhitelist(updated);
          updateWhitelistStat(updated.length);
        });
      });
    });
  });
}

function updateWhitelistStat(count) {
  document.getElementById("stat-whitelisted").textContent = count;
}

// initial load
chrome.storage.local.get(["stats", "whitelist"], (result) => {
  const stats = result.stats || { scanned: 0, flagged: 0, whitelisted: 0 };
  const whitelist = result.whitelist || [];

  document.getElementById("stat-scanned").textContent = stats.scanned;
  document.getElementById("stat-flagged").textContent = stats.flagged;
  document.getElementById("stat-whitelisted").textContent = whitelist.length;

  renderWhitelist(whitelist);
});

// clear all
document.getElementById("btn-clear-all").addEventListener("click", () => {
  chrome.storage.local.set({ whitelist: [] }, () => {
    renderWhitelist([]);
    updateWhitelistStat(0);
  });
});
