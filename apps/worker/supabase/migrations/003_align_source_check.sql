-- Migration 003: align source CHECK constraint with values actually inserted by the code.
--
-- 001_initial.sql constrained source to ('chainabuse','scam_sniffer','community','twitter'),
-- but apps/worker/src/ingest.ts inserts 'goplus' (live source) and
-- packages/sdk/src/domain-check.ts surfaces 'on-chain' (oracle PDA reads).
-- Both were silently rejected before this migration.
--
-- Non-destructive: keeps the historical 'chainabuse' and 'twitter' values valid so existing
-- rows seeded via scripts/seed-chainabuse-csv.ts or the Twitter fetcher remain queryable.

ALTER TABLE threat_reports
  DROP CONSTRAINT IF EXISTS threat_reports_source_check;

ALTER TABLE threat_reports
  ADD CONSTRAINT threat_reports_source_check
    CHECK (source IN ('chainabuse','scam_sniffer','community','twitter','goplus','on-chain'));
