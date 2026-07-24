-- MCDA registry: search aliases + periodic score update history
-- Supports weekly scheduled scans and the registry dashboard / autocomplete.

ALTER TABLE domains
    ADD COLUMN IF NOT EXISTS search_aliases TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN domains.search_aliases IS
    'Lowercase aliases for autocomplete (e.g. ecitizen, kra). Populated for verified registry domains.';

CREATE TABLE IF NOT EXISTS domain_score_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    overall_score NUMERIC(5, 2),
    category_breakdown JSONB NOT NULL DEFAULT '{}',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (source IN ('scheduled', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_domain_score_updates_domain_checked
    ON domain_score_updates (domain_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_domains_verified
    ON domains (is_verified)
    WHERE is_verified = true;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_lower_key
    ON organizations (lower(name));

ALTER TABLE domain_score_updates ENABLE ROW LEVEL SECURITY;
