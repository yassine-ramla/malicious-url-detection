// scripts/background.js
import extractFeatures from "./features.js";

const IGNORED_SCHEMES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "devtools://",
];

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

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  const url = details.url;
  if (IGNORED_SCHEMES.some((scheme) => url.startsWith(scheme))) return;

  chrome.storage.session.get("continuing", async (result) => {
    if (result.continuing) {
      chrome.storage.session.set({ continuing: false });
      return;
    }

    const features = await extractFeatures(url);
    if (!features) return;

    await ensureOffscreenDocument();

    chrome.runtime.sendMessage({ type: "PREDICT", features }, (response) => {
      if (!response || response.score === undefined) return;
      if (response.score < 0) return;

      chrome.storage.session.set(
        { pendingWarning: { url, features, score: response.score } },
        () => {
          chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("warning.html"),
          });
        },
      );
    });
  });
});
