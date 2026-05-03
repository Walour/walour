"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/promote.ts
var promote_exports = {};
__export(promote_exports, {
  default: () => handler
});
module.exports = __toCommonJS(promote_exports);
var import_supabase_js = require("@supabase/supabase-js");
var import_web3 = require("@solana/web3.js");
var anchor = __toESM(require("@coral-xyz/anchor"));
var PROMOTE_IDL = {
  version: "0.1.0",
  name: "walour_oracle",
  instructions: [
    {
      name: "updateConfidence",
      accounts: [
        { name: "threatReport", isMut: true, isSigner: false },
        { name: "oracleConfig", isMut: false, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [
        { name: "address", type: "publicKey" },
        { name: "newScore", type: "u8" }
      ]
    }
  ],
  accounts: [
    {
      name: "ThreatReport",
      type: {
        kind: "struct",
        fields: [
          { name: "address", type: "publicKey" },
          { name: "threatType", type: { defined: "ThreatType" } },
          { name: "source", type: { array: ["u8", 32] } },
          { name: "evidenceUrl", type: { array: ["u8", 128] } },
          { name: "confidence", type: "u8" },
          { name: "firstSeen", type: "i64" },
          { name: "lastUpdated", type: "i64" },
          { name: "corroborations", type: "u32" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "OracleConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "bump", type: "u8" }
        ]
      }
    }
  ],
  types: [
    {
      name: "ThreatType",
      type: {
        kind: "enum",
        variants: [
          { name: "Drainer" },
          { name: "Rug" },
          { name: "PhishingDomain" },
          { name: "MaliciousToken" }
        ]
      }
    }
  ],
  errors: []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
};
async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const startMs = Date.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const heliusKey = process.env.HELIUS_API_KEY;
  const programIdStr = process.env.WALOUR_PROGRAM_ID;
  const authorityKeyRaw = process.env.PROGRAM_AUTHORITY_KEYPAIR;
  if (!supabaseUrl || !supabaseKey || !heliusKey || !programIdStr || !authorityKeyRaw) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
  const authorityKeypair = import_web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(authorityKeyRaw))
  );
  const connection = new import_web3.Connection(
    `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
    "confirmed"
  );
  const wallet = new anchor.Wallet(authorityKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed"
  });
  anchor.setProvider(provider);
  PROMOTE_IDL.address = programIdStr;
  const programId = new import_web3.PublicKey(programIdStr);
  const program = new anchor.Program(PROMOTE_IDL, provider);
  const [oracleConfigPda] = import_web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  const { data: rows, error: fetchErr } = await supabase.from("threat_reports").select("id, address, confidence, threat_type").gt("confidence", 0.7).or("promoted_at.is.null,promoted_at.lt." + new Date(Date.now() - 864e5).toISOString()).order("confidence", { ascending: false }).limit(10);
  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: "Supabase fetch failed", detail: fetchErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const candidates = rows ?? [];
  let promoted = 0;
  let errors = 0;
  for (const row of candidates) {
    try {
      const address = new import_web3.PublicKey(row.address);
      const [threatReportPda] = import_web3.PublicKey.findProgramAddressSync(
        [Buffer.from("threat"), address.toBuffer()],
        programId
      );
      const onChainScore = Math.min(100, Math.round(row.confidence * 100));
      await program.methods.updateConfidence(address, onChainScore).accounts({
        threatReport: threatReportPda,
        oracleConfig: oracleConfigPda,
        authority: authorityKeypair.publicKey,
        systemProgram: import_web3.SystemProgram.programId
      }).rpc();
      const { error: updateErr } = await supabase.from("threat_reports").update({ promoted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", row.id);
      if (updateErr) {
        console.error(`[promote] Failed to mark row ${row.id} as promoted:`, updateErr.message);
      }
      promoted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[promote] Failed to promote ${row.address}:`, msg);
      await supabase.from("outages").insert({
        service: "promote-worker",
        error: msg,
        address: row.address,
        occurred_at: (/* @__PURE__ */ new Date()).toISOString()
      }).then(() => void 0);
      errors++;
    }
  }
  const duration_ms = Date.now() - startMs;
  return new Response(
    JSON.stringify({ promoted, errors, duration_ms }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
