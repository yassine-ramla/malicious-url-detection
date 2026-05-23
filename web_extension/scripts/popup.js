// scripts/popup.js
const STEP = 5;
const DEFAULT_WARNING = 45;
const DEFAULT_DANGER = 75;

let warningThreshold = DEFAULT_WARNING;
let dangerThreshold = DEFAULT_DANGER;

function updateThresholdUI() {
  document.getElementById("warning-value").textContent = `${warningThreshold}%`;
  document.getElementById("danger-value").textContent = `${dangerThreshold}%`;

  document.getElementById("warning-dec").disabled = warningThreshold <= 5;
  document.getElementById("warning-inc").disabled =
    warningThreshold >= dangerThreshold - STEP;
  document.getElementById("danger-dec").disabled =
    dangerThreshold <= warningThreshold + STEP;
  document.getElementById("danger-inc").disabled = dangerThreshold >= 95;
}

function saveThresholds() {
  chrome.storage.local.set({
    thresholds: { warning: warningThreshold, danger: dangerThreshold },
  });
}

document.getElementById("warning-dec").addEventListener("click", () => {
  if (warningThreshold - STEP >= 5) {
    warningThreshold -= STEP;
    updateThresholdUI();
    saveThresholds();
  }
});

document.getElementById("warning-inc").addEventListener("click", () => {
  if (warningThreshold + STEP < dangerThreshold) {
    warningThreshold += STEP;
    updateThresholdUI();
    saveThresholds();
  }
});

document.getElementById("danger-dec").addEventListener("click", () => {
  if (dangerThreshold - STEP > warningThreshold) {
    dangerThreshold -= STEP;
    updateThresholdUI();
    saveThresholds();
  }
});

document.getElementById("danger-inc").addEventListener("click", () => {
  if (dangerThreshold + STEP <= 95) {
    dangerThreshold += STEP;
    updateThresholdUI();
    saveThresholds();
  }
});

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
      <button class="btn-remove" data-hostname="${hostname}">×</button>
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
          document.getElementById("stat-whitelisted").textContent =
            updated.length;
        });
      });
    });
  });
}

// initial load
chrome.storage.local.get(["stats", "whitelist", "thresholds"], (result) => {
  const stats = result.stats || { scanned: 0, flagged: 0, whitelisted: 0 };
  const whitelist = result.whitelist || [];
  const thresholds = result.thresholds || {
    warning: DEFAULT_WARNING,
    danger: DEFAULT_DANGER,
  };

  warningThreshold = thresholds.warning;
  dangerThreshold = thresholds.danger;

  document.getElementById("stat-scanned").textContent = stats.scanned;
  document.getElementById("stat-flagged").textContent = stats.flagged;
  document.getElementById("stat-whitelisted").textContent = whitelist.length;

  updateThresholdUI();
  renderWhitelist(whitelist);
});

document.getElementById("btn-clear-all").addEventListener("click", () => {
  chrome.storage.local.set({ whitelist: [] }, () => {
    renderWhitelist([]);
    document.getElementById("stat-whitelisted").textContent = 0;
  });
});
