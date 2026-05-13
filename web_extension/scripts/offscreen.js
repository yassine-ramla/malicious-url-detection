// scripts/offscreen.js
import * as ort from "../lib/ort.wasm.min.mjs";
import { FEATURE_NAMES } from "./features.js";

ort.env.wasm.wasmPaths = chrome.runtime.getURL("lib/");

let session = null;

async function loadModel() {
  if (session) return session;
  const modelUrl = chrome.runtime.getURL("model.onnx");
  session = await ort.InferenceSession.create(modelUrl);
  return session;
}

async function predict(features) {
  const sess = await loadModel();
  const inputArray = new Float32Array(FEATURE_NAMES.map((name) => features[name] ?? 0));
  const tensor = new ort.Tensor("float32", inputArray, [1, FEATURE_NAMES.length]);
  const results = await sess.run({ float_input: tensor });

  // inspect output keys if this fails
  console.log("ONNX output keys:", Object.keys(results));

  const probabilities = results.probabilities.data;
  return probabilities[1];
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PREDICT") {
    predict(message.features)
      .then((score) => sendResponse({ score }))
      .catch((err) => {
        console.error("Prediction error:", err);
        sendResponse({ score: 0 });
      });
    return true; // keep channel open for async response
  }
});