// model.js
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

export async function predict(features) {
  const sess = await loadModel();

  // build float32 input vector in the exact feature order
  const inputArray = new Float32Array(
    FEATURE_NAMES.map((name) => features[name] ?? 0),
  );

  const tensor = new ort.Tensor("float32", inputArray, [
    1,
    FEATURE_NAMES.length,
  ]);
  const feeds = { float_input: tensor };
  const results = await sess.run(feeds);

  // XGBoost ONNX outputs probabilities under 'probabilities'
  // it's a map: {0: prob_benign, 1: prob_malicious}
  const probabilities = results.probabilities.data;
  return probabilities[1]; // malicious probability
}
