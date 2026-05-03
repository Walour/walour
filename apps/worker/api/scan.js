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

// src/scan.ts
var scan_exports = {};
__export(scan_exports, {
  default: () => scan_default
});
module.exports = __toCommonJS(scan_exports);
var import_web3 = require("@solana/web3.js");
var import_sdk = require("@walour/sdk");

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

// src/scan.ts
var KNOWN_PROGRAMS = /* @__PURE__ */ new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bSe",
  "ComputeBudget111111111111111111111111111111",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
]);
function getConnection() {
  return new import_web3.Connection(
    `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    "confirmed"
  );
}
async function resolveAccounts(tx, connection) {
  const staticKeys = tx.message.staticAccountKeys;
  const compiledInstructions = tx.message.compiledInstructions;
  const indexSet = /* @__PURE__ */ new Set();
  for (const ix of compiledInstructions) {
    for (const idx of ix.accountKeyIndexes) {
      indexSet.add(idx);
    }
  }
  const resolved = [...staticKeys];
  for (const idx of indexSet) {
    if (idx < staticKeys.length) {
      resolved.push(staticKeys[idx]);
    }
  }
  let failed = false;
  const lookups = tx.message.addressTableLookups;
  for (const lookup of lookups) {
    try {
      const alt = await connection.getAddressLookupTable(lookup.accountKey);
      if (!alt.value) {
        failed = true;
        continue;
      }
      for (const idx of lookup.writableIndexes) resolved.push(alt.value.state.addresses[idx]);
      for (const idx of lookup.readonlyIndexes) resolved.push(alt.value.state.addresses[idx]);
    } catch {
      failed = true;
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const key of resolved) {
    const str = key.toBase58();
    if (!seen.has(str)) {
      seen.add(str);
      unique.push(key);
    }
  }
  return { accounts: unique, failed };
}
function findLikelyMint(accounts) {
  for (const key of accounts) {
    const str = key.toBase58();
    if (!KNOWN_PROGRAMS.has(str)) {
      return str;
    }
  }
  return null;
}
async function handler(req) {
  const ALLOWED_ORIGIN = process.env.NODE_ENV === "development" ? "*" : "chrome-extension://*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const url = new URL(req.url, "http://localhost");
  const hostname = url.searchParams.get("hostname");
  const txParam = url.searchParams.get("tx");
  if (!hostname || hostname.trim() === "") {
    return new Response(JSON.stringify({ error: "hostname is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const connection = getConnection();
  let mintAddress = null;
  let altWarning = false;
  if (txParam) {
    try {
      const txBytes = Buffer.from(txParam, "base64");
      const tx = import_web3.VersionedTransaction.deserialize(txBytes);
      const { accounts, failed: altFailed } = await resolveAccounts(tx, connection);
      if (altFailed) altWarning = true;
      mintAddress = findLikelyMint(accounts);
    } catch {
      mintAddress = null;
    }
  }
  let drainerHit = null;
  if (txParam) {
    try {
      const txBytes = Buffer.from(txParam, "base64");
      const tx = import_web3.VersionedTransaction.deserialize(txBytes);
      const { accounts, failed: altFailed } = await resolveAccounts(tx, connection);
      if (altFailed) altWarning = true;
      const nonProgram = accounts.filter((k) => !KNOWN_PROGRAMS.has(k.toBase58()));
      const hits = await Promise.all(nonProgram.map((k) => (0, import_sdk.lookupAddress)(k.toBase58())));
      const first = hits.find((h) => h !== null);
      if (first) drainerHit = { address: first.address, confidence: first.confidence };
    } catch {
    }
  }
  const [domainResult, tokenResult] = await Promise.all([
    (0, import_sdk.checkDomain)(hostname),
    mintAddress ? (0, import_sdk.checkTokenRisk)(mintAddress) : Promise.resolve(null)
  ]);
  const finalDomain = drainerHit ? {
    level: "RED",
    reason: `Transaction destination ${drainerHit.address.slice(0, 8)}... is a known threat (confidence ${Math.round(drainerHit.confidence * 100)}%)`,
    confidence: drainerHit.confidence,
    source: "corpus"
  } : domainResult;
  const responseBody = { domain: finalDomain, token: tokenResult };
  if (altWarning) responseBody.altWarning = true;
  return new Response(
    JSON.stringify(responseBody),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}
var scan_default = adaptForVercel(handler);
