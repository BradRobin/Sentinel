-- Optional geography for non-county MCDAs (ministries / agencies).
-- Counties continue to use ADM1 polygons; these fields drive HQ markers + drill-down.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS hq_county TEXT;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN organizations.hq_county IS
    'County name matching registry/ADM1 (e.g. Nairobi) for national org HQ drill-down';
COMMENT ON COLUMN organizations.latitude IS
    'Optional HQ latitude (WGS84) for map markers';
COMMENT ON COLUMN organizations.longitude IS
    'Optional HQ longitude (WGS84) for map markers';
