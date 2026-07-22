"""Apply Supabase migration if not already applied."""

from pathlib import Path

import psycopg

from app.core.config import settings

MIGRATION = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "20260722120000_initial_schema.sql"


def main() -> None:
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            print("DB connection: ok")

            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'organizations'
                )
                """
            )
            exists = cur.fetchone()[0]
            if exists:
                print("Migration already applied: organizations table exists")
            else:
                cur.execute(MIGRATION.read_text(encoding="utf-8"))
                print("Migration applied successfully")

            cur.execute("SELECT COUNT(*) FROM standards_reference")
            print("standards_reference rows:", cur.fetchone()[0])
            cur.execute("SELECT COUNT(*) FROM scoring_weights")
            print("scoring_weights rows:", cur.fetchone()[0])


if __name__ == "__main__":
    main()
