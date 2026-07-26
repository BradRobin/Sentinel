"""Bootstrap local Docker Postgres: schema stubs, migrations, MCDA seed.

Used by the ``db-init`` Compose service so the API always has a working
registry without depending on a reachable hosted Supabase pooler.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import psycopg

from app.core.config import settings
from app.core.database import close_pool
from app.data.mcda_registry import MCDA_REGISTRY
from app.services.registry import upsert_registry_entry

_AUTH_STUB = """
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULL::UUID;
$$;

DO $$
BEGIN
    CREATE ROLE authenticated;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE ROLE service_role;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;
"""


def _migrations_dir() -> Path:
    candidates = [
        Path("/supabase/migrations"),
        Path(__file__).resolve().parents[2] / "supabase" / "migrations",
    ]
    for path in candidates:
        if path.is_dir():
            return path
    raise FileNotFoundError(
        "supabase/migrations not found (mount ./supabase at /supabase in Docker)"
    )


def wait_for_db(url: str, *, attempts: int = 40, delay: float = 1.5) -> None:
    last: Exception | None = None
    for i in range(1, attempts + 1):
        try:
            with psycopg.connect(url, connect_timeout=3) as conn:
                conn.execute("SELECT 1")
            print(f"DB ready (attempt {i})")
            return
        except Exception as exc:  # noqa: BLE001 — retry until ready
            last = exc
            print(f"Waiting for DB ({i}/{attempts}): {exc}")
            time.sleep(delay)
    raise RuntimeError(f"Database not ready after {attempts} attempts: {last}")


def apply_sql_file(conn: psycopg.Connection, path: Path) -> None:
    print(f"Applying {path.name} …")
    conn.execute(path.read_text(encoding="utf-8"))
    print(f"Applied {path.name}")


def ensure_schema(conn: psycopg.Connection) -> None:
    conn.execute(_AUTH_STUB)

    has_orgs = conn.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'organizations'
        )
        """
    ).fetchone()[0]
    migrations = _migrations_dir()
    if not has_orgs:
        apply_sql_file(conn, migrations / "20260722120000_initial_schema.sql")
    else:
        print("Schema: organizations already present")

    has_updates = conn.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'domain_score_updates'
        )
        """
    ).fetchone()[0]
    if not has_updates:
        apply_sql_file(conn, migrations / "20260724120000_mcda_registry.sql")
    else:
        conn.execute(
            """
            ALTER TABLE domains
            ADD COLUMN IF NOT EXISTS search_aliases TEXT[] NOT NULL DEFAULT '{}'
            """
        )
        print("Schema: domain_score_updates already present")


def seed_registry() -> int:
    count = 0
    for entry in MCDA_REGISTRY:
        upsert_registry_entry(
            org_name=entry["org_name"],
            org_type=entry["org_type"],
            sector=entry["sector"],
            url=entry["url"],
            registered_name=entry["registered_name"],
            aliases=entry["aliases"],
        )
        count += 1
    return count


def main() -> None:
    url = os.environ.get("DATABASE_URL") or settings.database_url
    print(f"Bootstrap DATABASE_URL host={urlparse(url).hostname}")
    wait_for_db(url)

    with psycopg.connect(url, autocommit=True) as conn:
        ensure_schema(conn)

    try:
        seeded = seed_registry()
        print(f"Seeded {seeded} MCDA registry domains.")
    finally:
        close_pool()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
