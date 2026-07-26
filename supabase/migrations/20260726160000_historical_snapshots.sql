-- historical_scores: one row per scan snapshot (not one per calendar quarter)
-- Quarter remains a derived display label only.

ALTER TABLE historical_scores
    ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scan_id UUID REFERENCES scans(id) ON DELETE SET NULL;

UPDATE historical_scores
SET snapshot_at = COALESCE(snapshot_at, created_at, now())
WHERE snapshot_at IS NULL;

ALTER TABLE historical_scores
    ALTER COLUMN snapshot_at SET DEFAULT now(),
    ALTER COLUMN snapshot_at SET NOT NULL;

ALTER TABLE historical_scores
    DROP CONSTRAINT IF EXISTS historical_scores_domain_id_quarter_key;

CREATE UNIQUE INDEX IF NOT EXISTS historical_scores_scan_id_uidx
    ON historical_scores (scan_id)
    WHERE scan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_historical_scores_domain_snapshot
    ON historical_scores (domain_id, snapshot_at DESC);

COMMENT ON COLUMN historical_scores.quarter IS
    'Derived calendar-quarter label for display only; not the comparison key.';
COMMENT ON COLUMN historical_scores.snapshot_at IS
    'When this score snapshot was taken (usually scan completion time).';
COMMENT ON COLUMN historical_scores.scan_id IS
    'Optional link to the scan that produced this snapshot; unique when set.';
