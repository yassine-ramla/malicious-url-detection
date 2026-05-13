// features.js
import { parse } from "../lib/tldts.esm.min.js";

function normalizeUrl(url) {
  // strip trailing slashes
  url = url.replace(/\/+$/, "");

  // iterative unquoting to match Python's behavior
  try {
    let prev;
    do {
      prev = url;
      url = decodeURIComponent(url);
    } while (url !== prev);
  } catch {
    // malformed percent encoding — leave as is
  }

  return url;
}

function alphaDigitTransitions(s) {
  let count = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i],
      b = s[i + 1];
    if ((isAlpha(a) && isDigit(b)) || (isDigit(a) && isAlpha(b))) count++;
  }
  return count;
}

function digitSymbolTransitions(s) {
  let count = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i],
      b = s[i + 1];
    if ((isDigit(a) && !isAlnum(b)) || (!isAlnum(a) && isDigit(b))) count++;
  }
  return count;
}

function alnumSymbolTransitions(s) {
  let count = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i],
      b = s[i + 1];
    if ((isAlnum(a) && !isAlnum(b)) || (!isAlnum(a) && isAlnum(b))) count++;
  }
  return count;
}

function shannonEntropy(s) {
  if (!s) return 0;
  const counts = {};
  for (const c of s) counts[c] = (counts[c] || 0) + 1;
  const len = s.length;
  return -Object.values(counts).reduce(
    (sum, c) => sum + (c / len) * Math.log2(c / len),
    0,
  );
}

function isAlpha(c) {
  return /[a-zA-Z]/.test(c);
}
function isDigit(c) {
  return /[0-9]/.test(c);
}
function isAlnum(c) {
  return /[a-zA-Z0-9]/.test(c);
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function max(arr) {
  return arr.length ? Math.max(...arr) : 0;
}
function min(arr) {
  return arr.length ? Math.min(...arr) : 0;
}

async function compressionRatio(url) {
  if (!url) return 0;
  const encoded = new TextEncoder().encode(url);
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  writer.write(encoded);
  writer.close();
  const chunks = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const compressed = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  return compressed / encoded.length;
}

export default async function extractFeatures(rawUrl) {
  const url = normalizeUrl(rawUrl);
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const tld = parse(url);

  const parts = {
    hostname: (tld.hostname || "").toLowerCase(),
    subdomain: (tld.subdomain || "").toLowerCase(),
    domain: (tld.domainWithoutSuffix || "").toLowerCase(),
    suffix: (tld.publicSuffix || "").toLowerCase(),
    top_domain_under_public_suffix: (tld.domain || "").toLowerCase(),
    path: parsedUrl.pathname.replace(/\/+$/, "") || "",
    query: parsedUrl.search.replace(/^\?/, "") || "",
    fragment: parsedUrl.hash.replace(/^#/, "") || "",
  };

  const features = {};

  // lengths
  for (const [key, val] of Object.entries(parts)) {
    features[`${key}_length`] = val.length;
  }

  // transitions
  for (const [key, val] of Object.entries(parts)) {
    features[`${key}_alpha_digit_transitions`] = alphaDigitTransitions(val);
    features[`${key}_digit_symbol_transitions`] = digitSymbolTransitions(val);
    features[`${key}_alnum_symbol_transitions`] = alnumSymbolTransitions(val);
  }

  // flags
  features["has_https"] = parsedUrl.protocol === "https:" ? 1 : 0;
  features["has_port"] = parsedUrl.port ? 1 : 0;
  features["has_params"] = parsedUrl.pathname.includes(";") ? 1 : 0;
  features["has_base64_like"] = /[A-Za-z0-9+/]{20,}={0,2}/.test(url) ? 1 : 0;

  // path structure
  const pathSegments = parts.path.split("/").filter(Boolean);
  features["path_segments_num"] = pathSegments.length;
  features["avg_path_segment_len"] = mean(pathSegments.map((s) => s.length));
  features["max_path_segment_len"] = max(pathSegments.map((s) => s.length));
  features["min_path_segment_len"] = min(pathSegments.map((s) => s.length));

  // query structure
  const queryParams = parts.query ? parts.query.split("&") : [];
  features["query_params_num"] = queryParams.length;
  features["avg_query_param_len"] = mean(queryParams.map((p) => p.length));
  features["max_query_param_len"] = max(queryParams.map((p) => p.length));
  features["min_query_param_len"] = min(queryParams.map((p) => p.length));

  // digits
  for (const key of [
    "hostname",
    "subdomain",
    "domain",
    "top_domain_under_public_suffix",
    "path",
    "query",
    "fragment",
  ]) {
    const val = parts[key];
    const digitsNum = [...val].filter(isDigit).length;
    features[`digits_${key}`] = digitsNum;
    features[`digits_ratio_${key}`] = val.length ? digitsNum / val.length : 0;
  }

  // special chars
  for (const [key, val] of Object.entries(parts)) {
    const specialChars = (val.match(/[^a-zA-Z0-9]/g) || []).length;
    features[`special_chars_${key}`] = specialChars;
    features[`special_chars_ratio_${key}`] = val.length
      ? specialChars / val.length
      : 0;
  }

  // ats, dots, underscores, percent
  for (const key of ["path", "query", "fragment"]) {
    const val = parts[key];
    features[`num_ats_${key}`] = (val.match(/@/g) || []).length;
    features[`num_dots_${key}`] = (val.match(/\./g) || []).length;
    features[`num_underscores_${key}`] = (val.match(/_/g) || []).length;
    features[`num_percent_${key}`] = (val.match(/%/g) || []).length;
  }

  // max char repeat
  for (const [key, val] of Object.entries(parts)) {
    const repeats = [...val.matchAll(/(.)\1+/g)].map((m) => m[0].length);
    features[`max_char_repeat_${key}`] = repeats.length
      ? Math.max(...repeats)
      : 0;
  }

  // caps
  for (const key of ["path", "query", "fragment"]) {
    const val = parts[key];
    const capsNum = [...val].filter((c) => c >= "A" && c <= "Z").length;
    features[`caps_${key}`] = capsNum;
    features[`caps_ratio_${key}`] = val.length ? capsNum / val.length : 0;
  }

  // typosquatting
  for (const key of [
    "hostname",
    "domain",
    "subdomain",
    "top_domain_under_public_suffix",
  ]) {
    const val = parts[key];
    features[`num_rn_pattern_${key}`] = (val.match(/rn/g) || []).length;
    features[`num_0_${key}`] = (val.match(/0/g) || []).length;
    features[`num_1_${key}`] = (val.match(/1/g) || []).length;
  }

  // tokens
  for (const key of ["hostname", "path", "query", "fragment"]) {
    const val = parts[key];
    features[`num_tokens_${key}`] = val ? val.split(/[^a-zA-Z0-9]+/).length : 0;
  }

  // longest subdomain
  const subdomainParts = parts.subdomain ? parts.subdomain.split(".") : [];
  features["longest_subdomain_len"] = max(subdomainParts.map((s) => s.length));

  // compression ratio
  features["compression_ratio"] = await compressionRatio(url);

  // entropy
  for (const [key, val] of Object.entries(parts)) {
    features[`${key}_entropy`] = shannonEntropy(val);
  }

  // path pollution
  const path = parts.path;
  features["consecutive_slashes"] = (path.match(/\/\//g) || []).length;
  features["double_dots"] = (path.match(/\.\./g) || []).length;
  features["empty_segments"] = Math.max(
    0,
    path.split("/").filter((s) => !s).length - 1,
  );
  const extensions = path.match(/\.[a-z0-9]{2,4}/gi) || [];
  features["suspicious_extensions"] = extensions.length > 1 ? 1 : 0;

  // query pollution
  const query = parts.query;
  if (query) {
    const paramsList = query.split("&");
    const keys = [],
      values = [];
    let emptyValues = 0,
      emptyKeys = 0;

    for (const param of paramsList) {
      if (param.includes("=")) {
        const [k, v] = param.split("=");
        keys.push(k);
        values.push(v);
        if (!k) emptyKeys++;
        if (!v) emptyValues++;
      } else {
        keys.push(param);
        emptyValues++;
      }
    }

    const keyCounts = {};
    for (const k of keys) keyCounts[k] = (keyCounts[k] || 0) + 1;
    const duplicateKeys = Object.values(keyCounts).filter((c) => c > 1).length;
    const maxKeyFrequency = max(Object.values(keyCounts));
    const totalKeysLen = keys.reduce((s, k) => s + k.length, 0);
    const totalValuesLen = values.reduce((s, v) => s + v.length, 0);

    features["duplicate_keys"] = duplicateKeys;
    features["empty_values"] = emptyValues;
    features["empty_keys"] = emptyKeys;
    features["max_key_frequency"] = maxKeyFrequency;
    features["suspicious_key_value_ratio"] =
      totalKeysLen / Math.max(totalValuesLen, 1);
  } else {
    features["duplicate_keys"] = 0;
    features["empty_values"] = 0;
    features["empty_keys"] = 0;
    features["max_key_frequency"] = 0;
    features["suspicious_key_value_ratio"] = 0;
  }

  return features;
}

export const FEATURE_NAMES = [
  "hostname_length",
  "subdomain_length",
  "domain_length",
  "suffix_length",
  "top_domain_under_public_suffix_length",
  "path_length",
  "query_length",
  "fragment_length",
  "hostname_alpha_digit_transitions",
  "hostname_digit_symbol_transitions",
  "hostname_alnum_symbol_transitions",
  "subdomain_alpha_digit_transitions",
  "subdomain_digit_symbol_transitions",
  "subdomain_alnum_symbol_transitions",
  "domain_alpha_digit_transitions",
  "domain_digit_symbol_transitions",
  "domain_alnum_symbol_transitions",
  "suffix_alpha_digit_transitions",
  "suffix_digit_symbol_transitions",
  "suffix_alnum_symbol_transitions",
  "top_domain_under_public_suffix_alpha_digit_transitions",
  "top_domain_under_public_suffix_digit_symbol_transitions",
  "top_domain_under_public_suffix_alnum_symbol_transitions",
  "path_alpha_digit_transitions",
  "path_digit_symbol_transitions",
  "path_alnum_symbol_transitions",
  "query_alpha_digit_transitions",
  "query_digit_symbol_transitions",
  "query_alnum_symbol_transitions",
  "fragment_alpha_digit_transitions",
  "fragment_digit_symbol_transitions",
  "fragment_alnum_symbol_transitions",
  "has_https",
  "has_port",
  "has_params",
  "has_base64_like",
  "path_segments_num",
  "avg_path_segment_len",
  "max_path_segment_len",
  "min_path_segment_len",
  "query_params_num",
  "avg_query_param_len",
  "max_query_param_len",
  "min_query_param_len",
  "digits_hostname",
  "digits_ratio_hostname",
  "digits_subdomain",
  "digits_ratio_subdomain",
  "digits_domain",
  "digits_ratio_domain",
  "digits_top_domain_under_public_suffix",
  "digits_ratio_top_domain_under_public_suffix",
  "digits_path",
  "digits_ratio_path",
  "digits_query",
  "digits_ratio_query",
  "digits_fragment",
  "digits_ratio_fragment",
  "special_chars_hostname",
  "special_chars_ratio_hostname",
  "special_chars_subdomain",
  "special_chars_ratio_subdomain",
  "special_chars_domain",
  "special_chars_ratio_domain",
  "special_chars_suffix",
  "special_chars_ratio_suffix",
  "special_chars_top_domain_under_public_suffix",
  "special_chars_ratio_top_domain_under_public_suffix",
  "special_chars_path",
  "special_chars_ratio_path",
  "special_chars_query",
  "special_chars_ratio_query",
  "special_chars_fragment",
  "special_chars_ratio_fragment",
  "num_ats_path",
  "num_dots_path",
  "num_underscores_path",
  "num_percent_path",
  "num_ats_query",
  "num_dots_query",
  "num_underscores_query",
  "num_percent_query",
  "num_ats_fragment",
  "num_dots_fragment",
  "num_underscores_fragment",
  "num_percent_fragment",
  "max_char_repeat_hostname",
  "max_char_repeat_subdomain",
  "max_char_repeat_domain",
  "max_char_repeat_suffix",
  "max_char_repeat_top_domain_under_public_suffix",
  "max_char_repeat_path",
  "max_char_repeat_query",
  "max_char_repeat_fragment",
  "caps_path",
  "caps_ratio_path",
  "caps_query",
  "caps_ratio_query",
  "caps_fragment",
  "caps_ratio_fragment",
  "num_rn_pattern_hostname",
  "num_0_hostname",
  "num_1_hostname",
  "num_rn_pattern_domain",
  "num_0_domain",
  "num_1_domain",
  "num_rn_pattern_subdomain",
  "num_0_subdomain",
  "num_1_subdomain",
  "num_rn_pattern_top_domain_under_public_suffix",
  "num_0_top_domain_under_public_suffix",
  "num_1_top_domain_under_public_suffix",
  "num_tokens_hostname",
  "num_tokens_path",
  "num_tokens_query",
  "num_tokens_fragment",
  "longest_subdomain_len",
  "compression_ratio",
  "hostname_entropy",
  "subdomain_entropy",
  "domain_entropy",
  "suffix_entropy",
  "top_domain_under_public_suffix_entropy",
  "path_entropy",
  "query_entropy",
  "fragment_entropy",
  "consecutive_slashes",
  "double_dots",
  "empty_segments",
  "suspicious_extensions",
  "duplicate_keys",
  "empty_values",
  "empty_keys",
  "max_key_frequency",
  "suspicious_key_value_ratio",
];
