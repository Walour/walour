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

// src/simulate.ts
var simulate_exports = {};
__export(simulate_exports, {
  default: () => simulate_default
});
module.exports = __toCommonJS(simulate_exports);
var import_web3 = require("@solana/web3.js");

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

// src/simulate.ts
function getConnection(cluster = "mainnet") {
  const url = cluster === "devnet" ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  return new import_web3.Connection(url, "confirmed");
}
async function handler(req) {
  const ALLOWED_ORIGIN = process.env.NODE_ENV === "development" ? "*" : "chrome-extension://*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  try {
    const { txBase64, signerPubkey } = await req.json();
    if (!txBase64) {
      return new Response(JSON.stringify({ success: false, error: "txBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const txBytes = Buffer.from(txBase64, "base64");
    const tx = import_web3.VersionedTransaction.deserialize(txBytes);
    let sim = await getConnection("mainnet").simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      commitment: "confirmed"
    });
    if (sim.value.err) {
      const devSim = await getConnection("devnet").simulateTransaction(tx, {
        replaceRecentBlockhash: true,
        commitment: "confirmed"
      });
      if (!devSim.value.err) sim = devSim;
    }
    if (sim.value.err) {
      return new Response(JSON.stringify({ success: false, error: JSON.stringify(sim.value.err), solChangeLamports: 0, deltas: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const simVal = sim.value;
    const pre = simVal.preBalances ?? [];
    const post = simVal.postBalances ?? [];
    const solChangeLamports = (post[0] ?? 0) - (pre[0] ?? 0);
    const preTokenMap = /* @__PURE__ */ new Map();
    for (const tb of simVal.preTokenBalances ?? []) {
      preTokenMap.set(`${tb.accountIndex}:${tb.mint}`, {
        amount: tb.uiTokenAmount.amount,
        decimals: tb.uiTokenAmount.decimals,
        mint: tb.mint
      });
    }
    const deltas = [];
    for (const tb of simVal.postTokenBalances ?? []) {
      const key = `${tb.accountIndex}:${tb.mint}`;
      const preTb = preTokenMap.get(key);
      const preAmount = BigInt(preTb?.amount ?? "0");
      const postAmount = BigInt(tb.uiTokenAmount.amount);
      const diff = postAmount - preAmount;
      if (diff === 0n) continue;
      const decimals = tb.uiTokenAmount.decimals;
      const change = Number(diff) / Math.pow(10, decimals);
      deltas.push({
        mint: tb.mint,
        change,
        decimals,
        uiChange: (change >= 0 ? "+" : "") + change.toFixed(decimals > 4 ? 2 : decimals)
      });
    }
    void signerPubkey;
    const result = { success: true, solChangeLamports, deltas };
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg, solChangeLamports: 0, deltas: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
var simulate_default = adaptForVercel(handler);
