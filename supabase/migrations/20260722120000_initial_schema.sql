-- ICTA Sentinel initial schema (SRS Section 7)
-- Standard basis: ICTA.6.002:2019 Section 6.4

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

-- Seed: standards_reference (SRS Section 6.1–6.9 checklist)
INSERT INTO standards_reference (clause_number, title, category, automatability_type, check_name) VALUES
-- 6.1 Domain & identity (6.4.4 / 6.4.5)
('6.4.4', 'Domain ends in .go.ke or .gov.ke', 'domain_identity', 'A', 'domain_tld'),
('6.4.4', 'Domain ≤ 40 characters', 'domain_identity', 'A', 'domain_length'),
('6.4.4', 'Not entirely numeric', 'domain_identity', 'A', 'domain_not_numeric'),
('6.4.4', 'Only letters/numbers/hyphens, no leading/trailing hyphen, max one hyphen', 'domain_identity', 'A', 'domain_format'),
('6.4.4', 'Domain bears semantic connection to stated purpose', 'domain_identity', 'M', 'domain_semantic_relevance'),
('6.4.4', 'Not a personal name', 'domain_identity', 'P', 'domain_not_personal_name'),
('6.4.5', 'Not a duplicate of an already-registered entity', 'domain_identity', 'A', 'domain_not_duplicate'),
-- 6.2 Security (6.4.18.i, 6.4.21, 6.4.22)
('6.4.18.i', 'HTTPS enforced, valid certificate', 'security', 'A', 'https_valid_cert'),
('6.4.21', 'Security headers present (HSTS, CSP, X-Frame-Options)', 'security', 'A', 'security_headers'),
('6.4.22', 'Database isolation for web apps', 'security', 'M', 'db_isolation'),
('6.4.22', 'No malicious code / site not compromised', 'security', 'P', 'no_malicious_code'),
('6.4.22', 'CMS latest/patched version', 'security', 'P', 'cms_patched'),
('6.4.22', 'Regular vulnerability scanning process exists', 'security', 'M', 'vuln_scanning_process'),
('6.4.22', 'No exposed root/critical files (.git, .env, admin panels)', 'security', 'A', 'no_exposed_files'),
-- 6.3 Interoperability (6.4.8)
('6.4.8', 'Validates against current HTML/XML spec', 'interoperability', 'A', 'html_validation'),
('6.4.8', 'UTF-8 encoding', 'interoperability', 'A', 'utf8_encoding'),
-- 6.4 Accessibility (6.4.9, 6.4.20)
('6.4.9', 'Alt tags on all images/video/audio/plug-ins', 'accessibility', 'A', 'alt_tags_present'),
('6.4.9', 'Decorative graphics have empty alt', 'accessibility', 'A', 'decorative_empty_alt'),
('6.4.9', 'Image-as-link alt describes destination', 'accessibility', 'P', 'image_link_alt'),
('6.4.9', 'Video captions / audio descriptions / transcripts', 'accessibility', 'P', 'media_captions'),
('6.4.9', 'No embedded video without linked alternative', 'accessibility', 'P', 'embedded_video_alt'),
('6.4.9', 'Data tables have proper headers', 'accessibility', 'A', 'table_headers'),
('6.4.9', 'No flashing images / strobe effect', 'accessibility', 'P', 'no_flashing'),
('6.4.9', 'Form fields use LABEL, logical tab order', 'accessibility', 'A', 'form_labels'),
('6.4.9', 'Skip Navigation link present', 'accessibility', 'A', 'skip_nav'),
('6.4.20', 'Supports multiple user agents (responsive/mobile)', 'accessibility', 'P', 'responsive_mobile'),
-- 6.5 Design, fonts, branding (6.4.6, 6.4.7, 6.4.11, 6.4.12, 6.4.13)
('6.4.6', 'Uses external CSS, not excessive inline styling', 'design_branding', 'A', 'external_css'),
('6.4.7', '≤3 fonts, from approved/sans-serif list', 'design_branding', 'A', 'font_limit'),
('6.4.11', 'Server-side scripting preferred', 'design_branding', 'P', 'server_side_scripting'),
('6.4.12', 'Coat of arms / official banner present', 'design_branding', 'P', 'coat_of_arms'),
('6.4.13', 'Landing page has G4C/G4B/G2G index structure', 'design_branding', 'M', 'g4c_index_structure'),
-- 6.6 Multimedia & performance (6.4.16)
('6.4.16', 'Page load time 3–18 seconds', 'multimedia_performance', 'A', 'page_load_time'),
('6.4.16', 'Images reasonably optimized', 'multimedia_performance', 'A', 'image_optimization'),
('6.4.16', 'No autoplay audio/video', 'multimedia_performance', 'A', 'no_autoplay'),
('6.4.16', 'Images not distorted', 'multimedia_performance', 'M', 'images_not_distorted'),
-- 6.7 Legal & content (6.4.18.ii–iv, 6.4.19)
('6.4.18.ii', 'Privacy policy present and linked', 'legal_content', 'A', 'privacy_policy'),
('6.4.18.iii', 'Cookie consent present if cookies used', 'legal_content', 'A', 'cookie_consent'),
('6.4.18.iv', 'Disclaimer statement present', 'legal_content', 'A', 'disclaimer'),
('6.4.19', 'Copyright/attribution visible for non-GoK content', 'legal_content', 'M', 'copyright_attribution'),
('6.4.19', 'Content freshness (last-modified recency)', 'legal_content', 'P', 'content_freshness'),
-- 6.8 Online visibility / SEO (6.4.17)
('6.4.17', 'Meta title, meta description present', 'seo', 'A', 'meta_tags'),
('6.4.17', 'robots.txt and sitemap.xml present', 'seo', 'A', 'robots_sitemap'),
('6.4.17', 'Indexed by major search engines', 'seo', 'A', 'search_engine_indexed'),
-- 6.9 Monitoring (6.4.23) — feeds trend dashboard, not per-scan score
('6.4.23', 'Site availability / uptime', 'monitoring', 'A', 'site_availability');

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
