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

// src/decode.ts
var decode_exports = {};
__export(decode_exports, {
  default: () => decode_default
});
module.exports = __toCommonJS(decode_exports);
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

// src/decode.ts
var ALLOWED_ORIGIN = process.env.NODE_ENV === "development" ? "*" : "chrome-extension://*";
var corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  let txBase64;
  try {
    const body = await req.json();
    txBase64 = body?.txBase64;
    if (!txBase64 || typeof txBase64 !== "string" || txBase64.trim() === "") {
      return new Response(JSON.stringify({ error: "txBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  let tx;
  try {
    const txBytes = Buffer.from(txBase64, "base64");
    tx = import_web3.VersionedTransaction.deserialize(txBytes);
  } catch {
    return new Response(JSON.stringify({ error: "Failed to deserialize transaction" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = (0, import_sdk.decodeTransaction)(tx);
        for await (const chunk of generator) {
          const sseData = `data: ${JSON.stringify({ chunk })}

`;
          controller.enqueue(encoder.encode(sseData));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errMsg })}

`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache"
    }
  });
}
var decode_default = adaptForVercel(handler);
