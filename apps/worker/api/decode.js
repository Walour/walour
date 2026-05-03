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
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(decode_exports);
var import_web3 = require("@solana/web3.js");
var import_sdk = require("@walour/sdk");
var config = { runtime: "edge" };
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
