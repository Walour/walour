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

// src/blink.ts
var blink_exports = {};
__export(blink_exports, {
  default: () => handler
});
module.exports = __toCommonJS(blink_exports);
var import_sdk = require("@walour/sdk");
var BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const url = new URL(req.url);
  const address = url.searchParams.get("address") ?? "";
  if (!BASE58_RE.test(address)) {
    return blinkResponse({
      title: "Walour Threat Check",
      icon: "https://walour.xyz/logo.png",
      description: "Invalid Solana address. Please provide a valid base58 public key.",
      label: "Scan Another",
      links: { actions: [] }
    });
  }
  const [corpusHit, tokenResult] = await Promise.allSettled([
    (0, import_sdk.lookupAddress)(address),
    (0, import_sdk.checkTokenRisk)(address)
  ]);
  const hit = corpusHit.status === "fulfilled" ? corpusHit.value : null;
  const token = tokenResult.status === "fulfilled" ? tokenResult.value : null;
  let description;
  if (hit) {
    description = `\u26A0\uFE0F RED: Known ${hit.type}. Confidence ${(hit.confidence * 100).toFixed(0)}%. Do not interact.`;
  } else if (token?.level === "RED") {
    const reason = token.reasons[0] ?? "High risk detected.";
    description = `\u26A0\uFE0F RED: High-risk token. ${reason}. Do not sign.`;
  } else if (token?.level === "AMBER") {
    const reason = token.reasons[0] ?? "Risk factors present.";
    description = `\u26A1 AMBER: Token has risk factors. ${reason}. Proceed with caution.`;
  } else {
    description = `\u2705 GREEN: No threats detected for this address.`;
  }
  return blinkResponse({
    title: "Walour Threat Check",
    icon: "https://walour.xyz/logo.png",
    description,
    label: "Scan Another",
    links: {
      actions: [
        {
          label: "View Full Report",
          href: `https://walour.xyz/stats?address=${address}`,
          type: "external-link"
        }
      ]
    }
  });
}
function blinkResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Action-Version": "1",
      "Access-Control-Expose-Headers": "X-Action-Version"
    }
  });
}
