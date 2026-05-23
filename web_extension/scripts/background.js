// scripts/background.js
import extractFeatures from "./features.js";

const IGNORED_SCHEMES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "devtools://",
];

const IGNORED_PREFIXES = ["https://www.google.com/search?"];

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: ["WORKERS"],
      justification: "Run ONNX Runtime for malicious URL detection",
    });
  }
}

async function incrementStat(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get("stats", (result) => {
      const stats = result.stats || { scanned: 0, flagged: 0, whitelisted: 0 };
      stats[key] = (stats[key] || 0) + 1;
      chrome.storage.local.set({ stats }, resolve);
    });
  });
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const url = details.url;

  if (IGNORED_SCHEMES.some((scheme) => url.startsWith(scheme))) return;
  if (IGNORED_PREFIXES.some((prefix) => url.startsWith(prefix))) return;

  chrome.storage.session.get("continuing", async (result) => {
    if (result.continuing) {
      chrome.storage.session.set({ continuing: false });
      return;
    }

    // check whitelist
    chrome.storage.local.get(["whitelist", "thresholds"], async (result) => {
      const whitelist = result.whitelist || [];
      const thresholds = result.thresholds || { warning: 45, danger: 75 };
      const warningThreshold = thresholds.warning / 100;

      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch {
        return;
      }

      if (whitelist.includes(hostname)) return;

      await incrementStat("scanned");

      const features = await extractFeatures(url);
      if (!features) return;

      await ensureOffscreenDocument();

      chrome.runtime.sendMessage({ type: "PREDICT", features }, (response) => {
        if (!response || response.score === undefined) return;
        if (response.score < warningThreshold) return;

        chrome.storage.session.set(
          {
            pendingWarning: {
              url,
              features,
              score: response.score,
              thresholds,
            },
          },
          () => {
            chrome.tabs.update(details.tabId, {
              url: chrome.runtime.getURL("warning.html"),
            });
          },
        );
      });
    });
  });
});
