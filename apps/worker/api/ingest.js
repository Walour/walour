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
  default: () => ingest_default
});
module.exports = __toCommonJS(ingest_exports);
var import_supabase_js = require("@supabase/supabase-js");

// src/lib/adapt.ts
function adaptForVercel(handler2) {
  return async function(nodeReq, nodeRes) {
    try {
      const protocol = nodeReq.headers["x-forwarded-proto"] || "https";
      const host = nodeReq.headers["x-forwarded-host"] || nodeReq.headers.host || "localhost";
      const url = new URL(nodeReq.url ?? "/", `${protocol}://${host}`);
      const chunks = [];
      for await (const chunk of nodeReq) {
        chunks.push(chunk);
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : null;
      const flatHeaders = {};
      for (const [k, v] of Object.entries(nodeReq.headers)) {
        if (v !== void 0) flatHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
      }
      const reqInit = {
        method: nodeReq.method ?? "GET",
        headers: flatHeaders
      };
      if (body?.length) {
        Object.assign(reqInit, { body, duplex: "half" });
      }
      const webReq = new Request(url.toString(), reqInit);
      const webRes = await handler2(webReq);
      const resHeaders = {};
      webRes.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });
      nodeRes.writeHead(webRes.status, resHeaders);
      if (webRes.body) {
        const reader = webRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          nodeRes.write(value);
        }
      }
      nodeRes.end();
    } catch (err) {
      console.error("[adapt] Unhandled error:", err);
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(500, { "Content-Type": "application/json" });
        nodeRes.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    }
  };
}

// src/lib/cron-auth.ts
function unauthorized() {
  return new Response(
    JSON.stringify({ error: "unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
function bearerMatches(authHeader, secret) {
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
function verifyCronSecret(req) {
  const walourSecret = process.env.WALOUR_CRON_SECRET;
  const vercelSecret = process.env.CRON_SECRET;
  if (!walourSecret && !vercelSecret) {
    console.error("[cron-auth] Neither WALOUR_CRON_SECRET nor CRON_SECRET configured \u2014 refusing all requests");
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "server misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    };
  }
  const auth = req.headers.get("authorization") ?? "";
  const ok = walourSecret && bearerMatches(auth, walourSecret) || vercelSecret && bearerMatches(auth, vercelSecret);
  if (!ok) return { ok: false, response: unauthorized() };
  return { ok: true };
}

// src/ingest.ts
var TIMEOUT_MS = 55e3;
var FETCH_TIMEOUT_MS = 15e3;
var SOURCE_WEIGHTS = {
  scam_sniffer: 0.85,
  goplus: 0.8,
  community: 0.4,
  // M18: Twitter is unreliable as a primary source — addresses extracted from
  // tweet text are easily injected. Down-weighted to 0.05 so it can only
  // corroborate, not flag on its own.
  twitter: 0.05
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
var SCAM_SNIFFER_ALL_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/7eb7b2669ef0d12e54ea10e4da76113644bc6402/blacklist/all.json";
var SCAM_SNIFFER_DOMAIN_LIMIT = 6e4;
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
  const apiKeyParam = process.env.GOPLUS_API_KEY ? `&apikey=${process.env.GOPLUS_API_KEY}` : "";
  const res = await withTimeout(
    fetch(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${addresses}${apiKeyParam}`, {
      headers: { "User-Agent": "Walour-Ingest/1.0", Accept: "application/json" }
    }),
    FETCH_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`GoPlus HTTP ${res.status}`);
  const json = await res.json();
  const entries = [];
  for (const [addr, data] of Object.entries(json?.result ?? {})) {
    if (data.trusted_token === 1) continue;
    const isRisky = data.mintable?.status === "1" || data.freezable?.status === "1" || data.transfer_fee?.status === "1";
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
  const MAX_ADDRESSES_PER_TWEET = 3;
  for (const tweet of data?.data ?? []) {
    const text = tweet.text ?? "";
    const addressMatches = (text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? []).slice(0, MAX_ADDRESSES_PER_TWEET);
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
async function handler(req) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return auth.response;
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
var ingest_default = adaptForVercel(handler);
