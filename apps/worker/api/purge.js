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

// src/purge.ts
var purge_exports = {};
__export(purge_exports, {
  default: () => handler
});
module.exports = __toCommonJS(purge_exports);
var import_supabase_js = require("@supabase/supabase-js");
async function handler(_req) {
  const supabase = (0, import_supabase_js.createClient)(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const start = Date.now();
  const { data, error, count } = await supabase.from("threat_reports").delete({ count: "exact" }).lt("confidence", 0.2).lt("last_updated", new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString());
  if (error) {
    console.error("[purge] Supabase delete failed:", error.message);
    return Response.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
  const purged = count ?? 0;
  const duration_ms = Date.now() - start;
  console.log(`[purge] Purged ${purged} stale threat_reports in ${duration_ms}ms`);
  return Response.json({ ok: true, purged, duration_ms });
}
