-- Add promoted_at column to track which entries have been pushed on-chain
ALTER TABLE threat_reports
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_threat_reports_promote
  ON threat_reports (confidence, promoted_at)
  WHERE confidence > 0.7;
