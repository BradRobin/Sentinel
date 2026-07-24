"""Apply MCDA registry migration (if needed) and seed organizations/domains.

DEV/ops tool — run manually::

    cd backend
    PYTHONPATH=. python scripts/seed_mcda_registry.py

Refuses production-looking DATABASE_URL / APP_ENV=production (same spirit as
the historical seed script). Pass ``--allow-remote`` only for staged deploys
where you intentionally seed a hosted Supabase project.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

import psycopg

from app.core.config import settings
from app.core.database import close_pool
from app.data.mcda_registry import MCDA_REGISTRY
from app.services.registry import upsert_registry_entry

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260724120000_mcda_registry.sql"
)

_PRODUCTION_APP_ENVS = frozenset({"production", "prod"})
_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})
_REMOTE_DB_MARKERS = (
    "supabase.com",
    "pooler.supabase.com",
    "neon.tech",
    "amazonaws.com",
    "rds.amazonaws.com",
)


def _looks_local(database_url: str) -> bool:
    lower = database_url.lower()
    if any(m in lower for m in _REMOTE_DB_MARKERS):
        return False
    host = (urlparse(database_url).hostname or "").lower()
    return host in _LOCAL_HOSTS or (
        ":54322" in database_url and "localhost" in lower
    )


def assert_safe(*, allow_remote: bool) -> None:
    app_env = (settings.app_env or "").strip().lower()
    if app_env in _PRODUCTION_APP_ENVS and not allow_remote:
        print(
            f"REFUSED: APP_ENV={settings.app_env!r}. "
            "Pass --allow-remote to seed a non-local database deliberately.",
            file=sys.stderr,
        )
        sys.exit(2)
    if not allow_remote and not _looks_local(settings.database_url):
        host = urlparse(settings.database_url).hostname or "?"
        print(
            f"REFUSED: DATABASE_URL host={host!r} does not look local. "
            "Pass --allow-remote to proceed against a hosted database.",
            file=sys.stderr,
        )
        sys.exit(2)


def ensure_schema(conn: psycopg.Connection) -> None:
    exists = conn.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'domain_score_updates'
        )
        """
    ).fetchone()[0]
    if exists:
        # Still ensure search_aliases exists (partial applies)
        conn.execute(
            """
            ALTER TABLE domains
            ADD COLUMN IF NOT EXISTS search_aliases TEXT[] NOT NULL DEFAULT '{}'
            """
        )
        print("Schema: domain_score_updates already present")
        return

    if not MIGRATION.is_file():
        print(f"ERROR: migration not found at {MIGRATION}", file=sys.stderr)
        sys.exit(1)
    print(f"Applying migration {MIGRATION.name} …")
    conn.execute(MIGRATION.read_text(encoding="utf-8"))
    print("Schema: migration applied")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed MCDA organizations + verified domains registry"
    )
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Allow seeding against a non-local DATABASE_URL",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print entries only; do not write",
    )
    args = parser.parse_args()

    assert_safe(allow_remote=args.allow_remote)

    if args.dry_run:
        for entry in MCDA_REGISTRY:
            print(f"{entry['org_type']:8} {entry['url']:40} {entry['org_name']}")
        print(f"Dry run — {len(MCDA_REGISTRY)} entries")
        return

    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        # organizations table must exist (initial schema)
        has_orgs = conn.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'organizations'
            )
            """
        ).fetchone()[0]
        if not has_orgs:
            print(
                "ERROR: organizations table missing — apply the initial schema first.",
                file=sys.stderr,
            )
            sys.exit(1)
        ensure_schema(conn)

    try:
        count = 0
        for entry in MCDA_REGISTRY:
            domain_id = upsert_registry_entry(
                org_name=entry["org_name"],
                org_type=entry["org_type"],
                sector=entry["sector"],
                url=entry["url"],
                registered_name=entry["registered_name"],
                aliases=entry["aliases"],
            )
            count += 1
            print(f"  upserted {entry['url']} → {domain_id}")
        print(f"Seeded {count} MCDA registry domains.")
    finally:
        close_pool()


if __name__ == "__main__":
    main()
