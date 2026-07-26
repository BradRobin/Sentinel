-- ICTA Sentinel initial schema (SRS Section 7)
-- Standard basis: ICTA.6.003:2023 §6.5

-- Enums
CREATE TYPE organization_type AS ENUM ('ministry', 'county', 'agency');
CREATE TYPE scan_status AS ENUM ('queued', 'running', 'complete', 'failed');
CREATE TYPE triggered_type AS ENUM ('manual', 'scheduled');
CREATE TYPE finding_status AS ENUM ('pass', 'fail', 'manual_review');
CREATE TYPE severity_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE automatability_type AS ENUM ('A', 'P', 'M');
CREATE TYPE officer_role AS ENUM ('officer', 'admin');
CREATE TYPE outreach_status AS ENUM ('draft', 'approved', 'sent');

-- Organizations (MCDA registry)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type organization_type NOT NULL,
    sector TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Officers (extends auth.users — Phase 6 auth)
CREATE TABLE officers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role officer_role NOT NULL DEFAULT 'officer',
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Domains
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    url TEXT NOT NULL UNIQUE,
    registered_name TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scans
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES officers(id) ON DELETE SET NULL,
    status scan_status NOT NULL DEFAULT 'queued',
    triggered_type triggered_type NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Standards reference (SRS Section 6 checklist)
CREATE TABLE standards_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clause_number TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    automatability_type automatability_type NOT NULL,
    check_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Findings
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    check_name TEXT NOT NULL,
    clause_reference TEXT NOT NULL,
    status finding_status NOT NULL,
    severity severity_level NOT NULL DEFAULT 'medium',
    automatability_type automatability_type NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scores
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    weighted_score NUMERIC(5, 2),
    overall_score NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scan_id, category)
);

-- Historical scores (quarter aggregates)
CREATE TABLE historical_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    quarter TEXT NOT NULL,
    overall_score NUMERIC(5, 2),
    category_breakdown JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (domain_id, quarter)
);

-- Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    narrative_text TEXT,
    pdf_url TEXT
);

-- Outreach (draft → approved → sent; no auto-send)
CREATE TABLE outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    draft_text TEXT NOT NULL,
    status outreach_status NOT NULL DEFAULT 'draft',
    approved_by UUID REFERENCES officers(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurable scoring weights (SRS Section 6 proposed defaults)
CREATE TABLE scoring_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL UNIQUE,
    weight NUMERIC(5, 2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES officers(id) ON DELETE SET NULL
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor UUID REFERENCES officers(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scans_domain_id ON scans(domain_id);
CREATE INDEX idx_scans_status ON scans(status);
CREATE INDEX idx_findings_scan_id ON findings(scan_id);
CREATE INDEX idx_scores_scan_id ON scores(scan_id);
CREATE INDEX idx_historical_scores_domain_id ON historical_scores(domain_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- RLS: enable on all public tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Phase 1 policies: service role bypasses RLS; authenticated read stubs for Phase 6
-- Officers can read their own profile
CREATE POLICY "officers_read_own" ON officers
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- Authenticated officers can read standards reference
CREATE POLICY "standards_read_authenticated" ON standards_reference
    FOR SELECT TO authenticated
    USING (true);

-- Authenticated officers can read scoring weights
CREATE POLICY "scoring_weights_read_authenticated" ON scoring_weights
    FOR SELECT TO authenticated
    USING (true);

-- Seed: standards_reference (ICTA.6.003:2023 §6.5 checklist)
INSERT INTO standards_reference (clause_number, title, category, automatability_type, check_name) VALUES
-- Domain & identity (6.5.6–6.5.8; domain rules split in 2023)
('6.5.6', 'Domain ends in .go.ke or .gov.ke', 'domain_identity', 'A', 'domain_tld'),
('6.5.8', 'Domain ≤ 40 characters', 'domain_identity', 'A', 'domain_length'),
('6.5.8', 'Not entirely numeric', 'domain_identity', 'A', 'domain_not_numeric'),
('6.5.8', 'Only letters/numbers/hyphens, no leading/trailing hyphen, max one hyphen', 'domain_identity', 'A', 'domain_format'),
('6.5.7', 'Domain bears semantic connection to stated purpose', 'domain_identity', 'M', 'domain_semantic_relevance'),
('6.5.8', 'Not a personal name', 'domain_identity', 'P', 'domain_not_personal_name'),
('6.5.8', 'Not a duplicate of an already-registered entity', 'domain_identity', 'A', 'domain_not_duplicate'),
-- Security (6.5.21.i, 6.5.24, 6.5.25)
('6.5.21.i', 'HTTPS enforced, valid certificate', 'security', 'A', 'https_valid_cert'),
('6.5.24', 'Security headers present (HSTS, CSP, X-Frame-Options)', 'security', 'A', 'security_headers'),
('6.5.25', 'Database isolation for web apps', 'security', 'M', 'db_isolation'),
('6.5.25', 'No malicious code / site not compromised', 'security', 'P', 'no_malicious_code'),
('6.5.25', 'CMS latest/patched version', 'security', 'P', 'cms_patched'),
('6.5.25', 'Regular vulnerability scanning process exists', 'security', 'M', 'vuln_scanning_process'),
('6.5.25', 'No exposed root/critical files (.git, .env, admin panels)', 'security', 'A', 'no_exposed_files'),
-- Interoperability (6.5.11)
('6.5.11', 'Validates against current HTML/XML spec', 'interoperability', 'A', 'html_validation'),
('6.5.11', 'UTF-8 encoding', 'interoperability', 'A', 'utf8_encoding'),
-- Accessibility (6.5.12, 6.5.23)
('6.5.12', 'Alt tags on all images/video/audio/plug-ins', 'accessibility', 'A', 'alt_tags_present'),
('6.5.12', 'Decorative graphics have empty alt', 'accessibility', 'A', 'decorative_empty_alt'),
('6.5.12', 'Image-as-link alt describes destination', 'accessibility', 'P', 'image_link_alt'),
('6.5.12', 'Video captions / audio descriptions / transcripts', 'accessibility', 'P', 'media_captions'),
('6.5.12', 'No embedded video without linked alternative', 'accessibility', 'P', 'embedded_video_alt'),
('6.5.12', 'Data tables have proper headers', 'accessibility', 'A', 'table_headers'),
('6.5.12', 'No flashing images / strobe effect', 'accessibility', 'P', 'no_flashing'),
('6.5.12', 'Form fields use LABEL, logical tab order', 'accessibility', 'A', 'form_labels'),
('6.5.12', 'Skip Navigation link present', 'accessibility', 'A', 'skip_nav'),
('6.5.23', 'Supports multiple user agents (responsive/mobile)', 'accessibility', 'P', 'responsive_mobile'),
-- Design, fonts, branding (6.5.9, 6.5.10, 6.5.14–6.5.16)
('6.5.9', 'Uses external CSS, not excessive inline styling', 'design_branding', 'A', 'external_css'),
('6.5.10', '≤3 fonts, from approved/sans-serif list', 'design_branding', 'A', 'font_limit'),
('6.5.14', 'Server-side scripting preferred', 'design_branding', 'P', 'server_side_scripting'),
('6.5.15', 'Coat of arms / official banner present', 'design_branding', 'P', 'coat_of_arms'),
('6.5.16', 'Landing page has G4C/G4B/G2G index structure', 'design_branding', 'M', 'g4c_index_structure'),
-- Multimedia & performance (6.5.19)
('6.5.19', 'Page load time 3–18 seconds', 'multimedia_performance', 'A', 'page_load_time'),
('6.5.19', 'Images reasonably optimized', 'multimedia_performance', 'A', 'image_optimization'),
('6.5.19', 'No autoplay audio/video', 'multimedia_performance', 'A', 'no_autoplay'),
('6.5.19', 'Images not distorted', 'multimedia_performance', 'M', 'images_not_distorted'),
-- Legal & content (6.5.21.ii–iv, 6.5.22)
('6.5.21.ii', 'Privacy policy present and linked', 'legal_content', 'A', 'privacy_policy'),
('6.5.21.iii', 'Cookie consent present if cookies used', 'legal_content', 'A', 'cookie_consent'),
('6.5.21.iv', 'Disclaimer statement present', 'legal_content', 'A', 'disclaimer'),
('6.5.22', 'Copyright/attribution visible for non-GoK content', 'legal_content', 'M', 'copyright_attribution'),
('6.5.22', 'Content freshness (last-modified recency)', 'legal_content', 'P', 'content_freshness'),
-- Online visibility / SEO (6.5.20)
('6.5.20', 'Meta title, meta description present', 'seo', 'A', 'meta_tags'),
('6.5.20', 'robots.txt and sitemap.xml present', 'seo', 'A', 'robots_sitemap'),
('6.5.20', 'Indexed by major search engines', 'seo', 'A', 'search_engine_indexed'),
-- Monitoring (6.5.26) — feeds trend dashboard, not per-scan score
('6.5.26', 'Site availability / uptime', 'monitoring', 'A', 'site_availability');

-- Seed: scoring_weights (SRS Section 6 proposed defaults; monitoring excluded)
INSERT INTO scoring_weights (category, weight) VALUES
('domain_identity', 15.00),
('security', 30.00),
('interoperability', 10.00),
('accessibility', 20.00),
('design_branding', 10.00),
('multimedia_performance', 8.00),
('legal_content', 12.00),
('seo', 5.00);
