"""DEV/TESTING ONLY — seed a fabricated ``historical_scores`` row for a domain.

Use this to exercise "compare to last quarter" without waiting for a real prior
quarter of scans. Not exposed via any API route; run manually from the CLI.

Examples (from ``backend/``)::

    PYTHONPATH=. python scripts/seed_historical_quarter.py \\
        --domain example.go.ke --quarter 2026-Q1 --random

    PYTHONPATH=. python scripts/seed_historical_quarter.py \\
        --domain-id <uuid> --quarter 2026-Q2 \\
        --scores security=72,accessibility=81,seo=55

Safety: refuses to run when ``APP_ENV`` is production, or when ``DATABASE_URL``
looks like a remote/production database. Local Supabase (``localhost:54322``)
and explicit local hosts are allowed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from random import Random
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row

from app.core.config import settings
from app.services.historical import HISTORICAL_CATEGORY_KEYS
from app.services.scoring import DEFAULT_WEIGHTS

# ---------------------------------------------------------------------------
# Production guard — refuse before any write
# ---------------------------------------------------------------------------

_PRODUCTION_APP_ENVS = frozenset({"production", "prod"})
_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})
# Host/path fragments that indicate a hosted / non-dev database
_REMOTE_DB_MARKERS = (
    "supabase.com",
    "pooler.supabase.com",
    "neon.tech",
    "amazonaws.com",
    "rds.amazonaws.com",
    "azure.com",
    "digitalocean.com",
    "render.com",
)
_QUARTER_RE = re.compile(r"^(\d{4})-Q([1-4])$")

# Reasonable fake audit scores (percent) when --random is used
_RANDOM_LO = 35.0
_RANDOM_HI = 95.0


def _database_looks_local(database_url: str) -> bool:
    """True only for clearly local Postgres URLs (local Supabase / docker)."""
    raw = database_url.strip()
    lower = raw.lower()
    if any(marker in lower for marker in _REMOTE_DB_MARKERS):
        return False

    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host in _LOCAL_HOSTS:
        return True
    # Bare "postgresql://...@localhost:54322/..." already covered; also allow
    # default local Supabase port even if hostname parsing is odd.
    if ":54322" in raw and "localhost" in lower:
        return True
    return False


def assert_safe_to_seed() -> None:
    """Abort if this looks like production or a remote database.

    Checks both ``APP_ENV`` and ``DATABASE_URL`` so a mis-set env var alone
    cannot silently write fake history into real data.
    """
    app_env = (settings.app_env or "").strip().lower()
    if app_env in _PRODUCTION_APP_ENVS:
        print(
            "REFUSED: APP_ENV is "
            f"{settings.app_env!r}. seed_historical_quarter.py is a "
            "dev/testing tool and will not run against production.",
            file=sys.stderr,
        )
        sys.exit(2)

    if not _database_looks_local(settings.database_url):
        host = urlparse(settings.database_url).hostname or "(unknown host)"
        print(
            "REFUSED: DATABASE_URL does not look like a local development "
            f"database (host={host!r}). This script only runs against local "
            "Postgres (localhost / 127.0.0.1, typically port 54322). "
            "It will not seed remote or production databases.",
            file=sys.stderr,
        )
        sys.exit(2)


# ---------------------------------------------------------------------------
# Score helpers
# ---------------------------------------------------------------------------


def parse_quarter(value: str) -> str:
    match = _QUARTER_RE.match(value.strip())
    if not match:
        raise argparse.ArgumentTypeError(
            f"invalid quarter {value!r}; expected YYYY-Qn with n in 1..4 "
            "(e.g. 2026-Q1)"
        )
    return f"{match.group(1)}-Q{match.group(2)}"


def parse_scores(raw: str) -> dict[str, float]:
    """Parse ``key=val,key=val`` into a category map. Unknown keys are errors."""
    known = set(HISTORICAL_CATEGORY_KEYS)
    out: dict[str, float] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            raise argparse.ArgumentTypeError(
                f"invalid --scores fragment {part!r}; expected key=value"
            )
        key, val = part.split("=", 1)
        key = key.strip()
        if key not in known:
            raise argparse.ArgumentTypeError(
                f"unknown category {key!r}; valid: {', '.join(HISTORICAL_CATEGORY_KEYS)}"
            )
        try:
            score = float(val.strip())
        except ValueError as exc:
            raise argparse.ArgumentTypeError(
                f"invalid score for {key!r}: {val!r}"
            ) from exc
        if not 0.0 <= score <= 100.0:
            raise argparse.ArgumentTypeError(
                f"score for {key!r} must be between 0 and 100 (got {score})"
            )
        out[key] = round(score, 2)
    if not out:
        raise argparse.ArgumentTypeError("--scores was empty")
    return out


def random_breakdown(rng: Random) -> dict[str, float]:
    return {
        key: round(rng.uniform(_RANDOM_LO, _RANDOM_HI), 2)
        for key in HISTORICAL_CATEGORY_KEYS
    }


def fill_breakdown(
    partial: dict[str, float] | None,
    *,
    randomize_missing: bool,
    rng: Random,
) -> dict[str, float]:
    """Ensure all 8 scored categories are present (stable comparison diffs)."""
    out: dict[str, float] = {}
    for key in HISTORICAL_CATEGORY_KEYS:
        if partial and key in partial:
            out[key] = round(float(partial[key]), 2)
        elif randomize_missing:
            out[key] = round(rng.uniform(_RANDOM_LO, _RANDOM_HI), 2)
        else:
            out[key] = 0.0
    return out


def weighted_overall(breakdown: dict[str, float]) -> float:
    """Mirror scoring.py: weighted average using DEFAULT_WEIGHTS."""
    weighted_sum = 0.0
    weight_total = 0.0
    for key in HISTORICAL_CATEGORY_KEYS:
        weight = float(DEFAULT_WEIGHTS.get(key, 0.0))
        if weight <= 0:
            continue
        weighted_sum += float(breakdown[key]) * weight
        weight_total += weight
    if weight_total <= 0:
        return 0.0
    return round(weighted_sum / weight_total, 2)


# ---------------------------------------------------------------------------
# DB operations
# ---------------------------------------------------------------------------


def resolve_domain(
    conn: psycopg.Connection,
    *,
    domain_id: str | None,
    domain: str | None,
) -> dict:
    if domain_id:
        row = conn.execute(
            "SELECT id, url, registered_name FROM domains WHERE id = %s",
            (domain_id,),
        ).fetchone()
        if not row:
            print(f"ERROR: no domain with id={domain_id}", file=sys.stderr)
            sys.exit(1)
        return row

    assert domain is not None
    needle = domain.strip().lower()
    # Accept bare host or full URL; domains.url is stored as provided at scan time
    row = conn.execute(
        """
        SELECT id, url, registered_name FROM domains
        WHERE lower(url) = %s
           OR lower(url) = %s
           OR lower(url) LIKE %s
           OR lower(url) LIKE %s
        ORDER BY added_at DESC
        LIMIT 1
        """,
        (
            needle,
            f"https://{needle}",
            f"%://{needle}",
            f"%://{needle}/%",
        ),
    ).fetchone()
    if not row:
        print(
            f"ERROR: no domain matching {domain!r}. "
            "Scan the site once first, or pass --domain-id.",
            file=sys.stderr,
        )
        sys.exit(1)
    return row


def upsert_seed_row(
    conn: psycopg.Connection,
    *,
    domain_id: str,
    quarter: str,
    overall: float,
    breakdown: dict[str, float],
) -> None:
    conn.execute(
        """
        INSERT INTO historical_scores (
            domain_id, quarter, overall_score, category_breakdown
        ) VALUES (
            %s, %s, %s, %s::jsonb
        )
        ON CONFLICT (domain_id, quarter) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            category_breakdown = EXCLUDED.category_breakdown,
            created_at = now()
        """,
        (domain_id, quarter, overall, json.dumps(breakdown)),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "DEV/TESTING ONLY: insert a fabricated historical_scores row "
            "for compare-to-last-quarter testing. Refuses production DBs."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Categories: "
            + ", ".join(HISTORICAL_CATEGORY_KEYS)
            + "\n\n"
            "Safety: blocked when APP_ENV is production/prod, or when "
            "DATABASE_URL is not a local host."
        ),
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument(
        "--domain",
        help="Domain URL or hostname already present in domains (e.g. example.go.ke)",
    )
    target.add_argument(
        "--domain-id",
        help="Exact domains.id UUID",
    )
    parser.add_argument(
        "--quarter",
        required=True,
        type=parse_quarter,
        help="Calendar quarter label, e.g. 2026-Q1",
    )

    scores = parser.add_mutually_exclusive_group(required=True)
    scores.add_argument(
        "--random",
        action="store_true",
        help=f"Randomize all category scores in [{_RANDOM_LO:.0f}, {_RANDOM_HI:.0f}]",
    )
    scores.add_argument(
        "--scores",
        type=parse_scores,
        metavar="KEY=VAL,...",
        help=(
            "Explicit category scores; omitted categories default to 0 "
            "unless --fill-random is also set"
        ),
    )

    parser.add_argument(
        "--fill-random",
        action="store_true",
        help="With --scores, randomize any categories not listed",
    )
    parser.add_argument(
        "--overall",
        type=float,
        default=None,
        help="Override overall_score (default: weighted average of categories)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="RNG seed for reproducible --random / --fill-random values",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the row that would be written without inserting",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    # Parse first so ``--help`` works even when DATABASE_URL is remote.
    args = build_parser().parse_args(argv)

    print(
        "=== DEV/TESTING ONLY: seed_historical_quarter ===",
        file=sys.stderr,
    )
    assert_safe_to_seed()

    if args.fill_random and not args.scores:
        print("ERROR: --fill-random only applies with --scores", file=sys.stderr)
        sys.exit(1)
    if args.overall is not None and not (0.0 <= args.overall <= 100.0):
        print("ERROR: --overall must be between 0 and 100", file=sys.stderr)
        sys.exit(1)

    rng = Random(args.seed)
    if args.random:
        breakdown = random_breakdown(rng)
    else:
        breakdown = fill_breakdown(
            args.scores,
            randomize_missing=args.fill_random,
            rng=rng,
        )

    overall = (
        round(float(args.overall), 2)
        if args.overall is not None
        else weighted_overall(breakdown)
    )

    db_host = urlparse(settings.database_url).hostname or "?"
    print(
        f"APP_ENV={settings.app_env!r}  DB host={db_host!r}  (local — OK)",
        file=sys.stderr,
    )

    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        domain_row = resolve_domain(
            conn, domain_id=args.domain_id, domain=args.domain
        )
        domain_id = str(domain_row["id"])
        print(
            f"Domain: {domain_row['url']}  id={domain_id}",
            file=sys.stderr,
        )
        print(f"Quarter: {args.quarter}", file=sys.stderr)
        print(f"Overall: {overall}", file=sys.stderr)
        print("Category breakdown:", file=sys.stderr)
        for key in HISTORICAL_CATEGORY_KEYS:
            print(f"  {key}: {breakdown[key]}", file=sys.stderr)

        if args.dry_run:
            print("Dry run — no write.", file=sys.stderr)
            print(
                json.dumps(
                    {
                        "domain_id": domain_id,
                        "quarter": args.quarter,
                        "overall_score": overall,
                        "category_breakdown": breakdown,
                    },
                    indent=2,
                )
            )
            return

        upsert_seed_row(
            conn,
            domain_id=domain_id,
            quarter=args.quarter,
            overall=overall,
            breakdown=breakdown,
        )
        print(
            f"Upserted historical_scores for domain={domain_id} "
            f"quarter={args.quarter}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
