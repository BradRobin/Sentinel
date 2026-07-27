-- Officer manual review workflow
-- Part 1: data model

-- 1) Add check_type to standards_reference (only used for manual checklist items)
ALTER TABLE standards_reference
ADD COLUMN IF NOT EXISTS check_type TEXT;

-- site_inspection (11)
UPDATE standards_reference
SET check_type = 'site_inspection'
WHERE check_name IN (
    'domain_not_personal_name',
    'image_link_alt',
    'media_captions',
    'embedded_video_alt',
    'no_flashing',
    'responsive_mobile',
    'coat_of_arms',
    'g4c_index_structure',
    'images_not_distorted',
    'copyright_attribution',
    'content_freshness'
);

-- institutional_attestation (5)
UPDATE standards_reference
SET check_type = 'institutional_attestation'
WHERE check_name IN (
    'db_isolation',
    'no_malicious_code',
    'cms_patched',
    'vuln_scanning_process',
    'server_side_scripting'
);

-- 2) Manual review items table (persistent resolution state per domain/check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manual_review_status') THEN
        CREATE TYPE manual_review_status AS ENUM ('pending', 'pass', 'fail', 'flagged');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS manual_review_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    check_name TEXT NOT NULL REFERENCES standards_reference(check_name) ON DELETE CASCADE,
    category TEXT NOT NULL,
    check_type TEXT NOT NULL,
    current_status manual_review_status NOT NULL DEFAULT 'pending',
    justification TEXT,
    resolved_by UUID REFERENCES officers(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    next_review_due DATE,
    source_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    -- used for queue sorting: when the item most recently became pending/resolved
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (domain_id, check_name)
);

CREATE INDEX IF NOT EXISTS idx_manual_review_items_status_updated_at
    ON manual_review_items(status_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_review_items_next_due
    ON manual_review_items(next_review_due);

ALTER TABLE manual_review_items ENABLE ROW LEVEL SECURITY;

-- Keep policies permissive for now; server-side auth is enforced in API endpoints.
DO $$
BEGIN
    -- SELECT for authenticated officers
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'manual_review_items'
          AND policyname = 'manual_review_read_authenticated'
    ) THEN
        CREATE POLICY manual_review_read_authenticated
            ON manual_review_items
            FOR SELECT TO authenticated
            USING (true);
    END IF;

    -- UPDATE for authenticated officers
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'manual_review_items'
          AND policyname = 'manual_review_update_authenticated'
    ) THEN
        CREATE POLICY manual_review_update_authenticated
            ON manual_review_items
            FOR UPDATE TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

