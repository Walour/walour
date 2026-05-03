"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ingest.ts
var ingest_exports = {};
__export(ingest_exports, {
  default: () => handler
});
module.exports = __toCommonJS(ingest_exports);
var import_supabase_js = require("@supabase/supabase-js");
var TIMEOUT_MS = 55e3;
var FETCH_TIMEOUT_MS = 15e3;
var SOURCE_WEIGHTS = {
  chainabuse: 0.9,
  scam_sniffer: 0.85,
  goplus: 0.8,
  community: 0.4,
  twitter: 0.3
};
var SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
var DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
var VALID_TYPES = /* @__PURE__ */ new Set(["drainer", "rug", "phishing_domain", "malicious_token"]);
function isValidSolanaAddress(addr) {
  return SOLANA_BASE58_RE.test(addr);
}
function isValidDomain(addr) {
  const host = addr.replace(/^https?:\/\//, "").split("/")[0].split("?")[0];
  return DOMAIN_RE.test(host) && host.includes(".");
}
function isValidEntry(entry) {
  if (!entry.address) return false;
  if (isValidSolanaAddress(entry.address)) return true;
  if (entry.type === "phishing_domain" || normaliseType(entry.type) === "phishing_domain") {
    return isValidDomain(entry.address);
  }
  return false;
}
function normaliseType(raw) {
  if (!raw) return "drainer";
  const lower = raw.toLowerCase().trim();
  if (VALID_TYPES.has(lower)) return lower;
  if (lower.includes("rug")) return "rug";
  if (lower.includes("phish") || lower.includes("domain")) return "phishing_domain";
  if (lower.includes("token")) return "malicious_token";
  return "drainer";
}
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`fetch timeout after ${ms}ms`)), ms)
    )
  ]);
}
async function fetchChainabuse() {
  try {
    const res2 = await withTimeout(
      fetch("https://api.chainabuse.com/v0/reports?chain=solana&limit=500", {
        headers: {
          "User-Agent": "Walour-Ingest/1.0",
          Accept: "application/json"
        }
      }),
      FETCH_TIMEOUT_MS
    );
    if (res2.ok) {
      const json2 = await res2.json();
      const reports = json2?.reports ?? [];
      if (reports.length > 0) {
        return reports.map((r) => ({
          address: r.address ?? r.reportedAddress ?? "",
          type: normaliseType(r.type ?? r.category),
          source: "chainabuse",
          evidence_url: r.evidenceUrl ?? null
        }));
      }
    }
    console.warn(`[ingest] Chainabuse REST returned HTTP ${res2.status} \u2014 trying GraphQL`);
  } catch (err) {
    console.warn(`[ingest] Chainabuse REST threw: ${err instanceof Error ? err.message : String(err)} \u2014 trying GraphQL`);
  }
  const body = JSON.stringify({
    query: `query { reports(chain: "SOL", limit: 500) { address type { type } reportedUrl } }`
  });
  const res = await withTimeout(
    fetch("https://api.chainabuse.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Walour-Ingest/1.0" },
      body
    }),
    FETCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Chainabuse GraphQL HTTP ${res.status}`);
  const json = await res.json();
  return (json?.data?.reports ?? []).map((r) => ({
    address: r.address ?? "",
    type: normaliseType(r.type?.type),
    source: "chainabuse",
    evidence_url: r.reportedUrl ?? null
  }));
}
var SCAM_SNIFFER_ALL_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/all.json";
var SCAM_SNIFFER_DOMAIN_LIMIT = 1e4;
async function fetchScamSniffer() {
  const res = await withTimeout(
    fetch(SCAM_SNIFFER_ALL_URL, { headers: { "User-Agent": "Walour-Ingest/1.0" } }),
    FETCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`ScamSniffer HTTP ${res.status}`);
  const data = await res.json();
  const entries = [];
  const domains = (data.domains ?? []).slice(0, SCAM_SNIFFER_DOMAIN_LIMIT);
  for (const d of domains) {
    if (typeof d === "string" && d.length > 3) {
      entries.push({ address: d, type: "phishing_domain", source: "scam_sniffer", evidence_url: null });
    }
  }
  console.log(`[ingest] ScamSniffer: ${entries.length} phishing domains`);
  return entries;
}
var GOPLUS_SEED_MINTS = [
  "So11111111111111111111111111111111111111112"
  // wSOL (baseline — should return low risk)
];
async function fetchGoPlus() {
  if (GOPLUS_SEED_MINTS.length === 0) return [];
  const addresses = GOPLUS_SEED_MINTS.join(",");
  const res = await withTimeout(
    fetch(`https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=${addresses}`, {
      headers: { "User-Agent": "Walour-Ingest/1.0", Accept: "application/json" }
    }),
    FETCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`GoPlus HTTP ${res.status}`);
  const json = await res.json();
  const entries = [];
  for (const [addr, data] of Object.entries(json?.result ?? {})) {
    const isRisky = data.is_mintable === "1" || data.can_take_back_ownership === "1" || data.owner_change_balance === "1";
    if (isRisky) {
      entries.push({
        address: addr,
        type: "malicious_token",
        source: "goplus",
        evidence_url: null
      });
    }
  }
  return entries;
}
async function fetchTwitter() {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    console.warn("[ingest] TWITTER_BEARER_TOKEN not set \u2014 skipping Twitter source");
    return [];
  }
  const query = encodeURIComponent(
    "(solana OR sol) (scam OR drainer OR rug) -is:retweet lang:en has:links"
  );
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=100&tweet.fields=entities,author_id`;
  const res = await withTimeout(
    fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "User-Agent": "Walour-Ingest/1.0"
      }
    }),
    FETCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Twitter API HTTP ${res.status}`);
  const data = await res.json();
  const rawEntries = [];
  for (const tweet of data?.data ?? []) {
    const text = tweet.text ?? "";
    const addressMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? [];
    for (const address of addressMatches) {
      if (address.length < 32) continue;
      const evidenceUrl = tweet.entities?.urls?.[0]?.expanded_url ?? null;
      rawEntries.push({
        address,
        type: "drainer",
        source: "twitter",
        evidence_url: evidenceUrl
      });
    }
  }
  return rawEntries;
}
async function processEntries(supabase, entries) {
  let processed = 0;
  const errorBatch = [];
  for (const entry of entries) {
    try {
      if (!entry.address || !isValidEntry(entry)) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: `invalid_address_or_domain: "${entry.address}"`
        });
        continue;
      }
      const threatType = normaliseType(entry.type);
      if (!(entry.source in SOURCE_WEIGHTS)) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: `unknown_source: "${entry.source}"`
        });
        continue;
      }
      const weight = SOURCE_WEIGHTS[entry.source];
      const { error } = await supabase.rpc("upsert_threat", {
        p_address: entry.address,
        p_type: threatType,
        p_source: entry.source,
        p_evidence_url: entry.evidence_url ?? null,
        p_confidence_delta: weight
      });
      if (error) {
        errorBatch.push({
          source: entry.source,
          payload: entry,
          reason: error.message
        });
        continue;
      }
      processed++;
    } catch (err) {
      errorBatch.push({
        source: entry.source,
        payload: entry,
        reason: err instanceof Error ? err.message : String(err)
      });
    }
  }
  if (errorBatch.length > 0) {
    supabase.from("ingestion_errors").insert(errorBatch).then(({ error }) => {
      if (error) console.error("[ingest] Failed to persist ingestion_errors:", error.message);
    }).catch((e) => console.error("[ingest] ingestion_errors insert threw:", e));
  }
  return { processed, errorCount: errorBatch.length };
}
async function runSource(supabase, name, fetcher) {
  let outageId = null;
  try {
    const { data: outage } = await supabase.from("outages").insert({ provider: name, error_msg: "in_progress" }).select("id").single();
    outageId = outage?.id ?? null;
    const entries = await fetcher();
    if (outageId) {
      await supabase.from("outages").update({ closed_at: (/* @__PURE__ */ new Date()).toISOString(), error_msg: null }).eq("id", outageId);
    }
    console.log(`[ingest] ${name}: fetched ${entries.length} raw entries`);
    return entries;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ingest] ${name} source failed \u2014 skipping: ${msg}`);
    if (outageId) {
      try {
        await supabase.from("outages").update({ closed_at: (/* @__PURE__ */ new Date()).toISOString(), error_msg: msg }).eq("id", outageId);
      } catch {
      }
    }
    return [];
  }
}
async function handler(_req) {
  const start = Date.now();
  const supabase = (0, import_supabase_js.createClient)(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const deadline = new Promise(
    (_, reject) => setTimeout(() => reject(new Error("global timeout")), TIMEOUT_MS)
  );
  let allEntries;
  try {
    allEntries = await Promise.race([
      Promise.all([
        runSource(supabase, "chainabuse", fetchChainabuse),
        runSource(supabase, "scam_sniffer", fetchScamSniffer),
        runSource(supabase, "goplus", fetchGoPlus),
        runSource(supabase, "twitter", fetchTwitter)
      ]).then((results) => results.flat()),
      deadline
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] Aborted fetch phase: ${msg}`);
    allEntries = [];
  }
  const seen = /* @__PURE__ */ new Map();
  for (const entry of allEntries) {
    const existing = seen.get(entry.address);
    if (!existing || (SOURCE_WEIGHTS[entry.source] ?? 0) > (SOURCE_WEIGHTS[existing.source] ?? 0)) {
      seen.set(entry.address, entry);
    }
  }
  const deduped = Array.from(seen.values());
  console.log(`[ingest] ${allEntries.length} raw entries -> ${deduped.length} after dedup`);
  const { processed, errorCount } = await processEntries(supabase, deduped);
  const result = {
    processed,
    errors: errorCount,
    duration_ms: Date.now() - start
  };
  console.log("[ingest] Complete:", result);
  return Response.json(result);
}
