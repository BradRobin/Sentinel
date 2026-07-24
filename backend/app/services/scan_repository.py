"""Persist scans and findings to PostgreSQL."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.core.database import get_connection
from app.schemas.findings import Finding


def normalize_domain_url(url: str) -> str:
    from urllib.parse import urlparse

    p = urlparse(url.strip())
    scheme = p.scheme or "https"
    netloc = p.netloc or p.path.split("/")[0]
    return f"{scheme}://{netloc}".lower().rstrip("/")


def create_scan_record(
    url: str,
    *,
    triggered_type: str = "manual",
    domain_id: str | None = None,
) -> str:
    """Create a scan row, linking to an existing or newly upserted domain."""
    if triggered_type not in ("manual", "scheduled"):
        triggered_type = "manual"

    domain_url = normalize_domain_url(url)
    with get_connection() as conn:
        if domain_id:
            resolved_id = domain_id
        else:
            domain_row = conn.execute(
                """
                INSERT INTO domains (url)
                VALUES (%s)
                ON CONFLICT (url) DO UPDATE SET url = EXCLUDED.url
                RETURNING id
                """,
                (domain_url,),
            ).fetchone()
            resolved_id = str(domain_row["id"])

        scan_row = conn.execute(
            """
            INSERT INTO scans (domain_id, status, triggered_type)
            VALUES (%s, 'queued', %s::triggered_type)
            RETURNING id
            """,
            (str(resolved_id), triggered_type),
        ).fetchone()
        conn.commit()
        return str(scan_row["id"])


def update_scan_status(scan_id: str, status: str) -> None:
    completed = datetime.now(timezone.utc) if status in ("complete", "failed") else None
    with get_connection() as conn:
        if completed:
            conn.execute(
                """
                UPDATE scans SET status = %s::scan_status, completed_at = %s
                WHERE id = %s
                """,
                (status, completed, scan_id),
            )
        else:
            conn.execute(
                """
                UPDATE scans SET status = %s::scan_status
                WHERE id = %s
                """,
                (status, scan_id),
            )
        conn.commit()


def save_findings(scan_id: str, findings: list[Finding]) -> None:
    with get_connection() as conn:
        for f in findings:
            status = f.status.value if hasattr(f.status, "value") else f.status
            conn.execute(
                """
                INSERT INTO findings (
                    scan_id, category, check_name, clause_reference,
                    status, severity, automatability_type, detail
                ) VALUES (
                    %s, %s, %s, %s,
                    %s::finding_status, %s::severity_level, %s::automatability_type, %s::jsonb
                )
                """,
                (
                    scan_id,
                    f.category,
                    f.check_name,
                    f.clause_reference,
                    status,
                    f.severity,
                    f.automatability_type,
                    json.dumps(f.detail),
                ),
            )
        conn.commit()


def save_scores(scan_id: str, score_result: Any) -> None:
    """Persist category + overall scores for a scan (replaces prior rows for scan_id)."""
    from app.services.scoring import ScoreResult

    if not isinstance(score_result, ScoreResult):
        raise TypeError("score_result must be a ScoreResult")

    overall = round(score_result.overall_score, 2)
    with get_connection() as conn:
        conn.execute("DELETE FROM scores WHERE scan_id = %s", (scan_id,))
        for cat in score_result.categories:
            conn.execute(
                """
                INSERT INTO scores (scan_id, category, weighted_score, overall_score)
                VALUES (%s, %s, %s, %s)
                """,
                (scan_id, cat.category, round(cat.score, 2), overall),
            )
        conn.execute(
            """
            INSERT INTO scores (scan_id, category, weighted_score, overall_score)
            VALUES (%s, 'overall', %s, %s)
            """,
            (scan_id, overall, overall),
        )
        conn.commit()


def save_narrative(scan_id: str, narrative_text: str) -> None:
    """Persist AI narrative on the reports table (one row per generation)."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO reports (scan_id, narrative_text)
            VALUES (%s, %s)
            """,
            (scan_id, narrative_text),
        )
        conn.commit()


def get_narrative_for_scan(scan_id: str) -> str | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT narrative_text FROM reports
            WHERE scan_id = %s AND narrative_text IS NOT NULL
            ORDER BY generated_at DESC
            LIMIT 1
            """,
            (scan_id,),
        ).fetchone()
    if not row:
        return None
    text = row.get("narrative_text")
    return str(text) if text else None


def get_scores_for_scan(scan_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT category, weighted_score, overall_score
            FROM scores
            WHERE scan_id = %s
            ORDER BY category
            """,
            (scan_id,),
        ).fetchall()
    if not rows:
        return None
    categories = []
    overall = None
    for r in rows:
        if r["category"] == "overall":
            overall = float(r["overall_score"]) if r["overall_score"] is not None else None
        else:
            categories.append(
                {
                    "category": r["category"],
                    "score": float(r["weighted_score"]) if r["weighted_score"] is not None else 0.0,
                }
            )
            if overall is None and r["overall_score"] is not None:
                overall = float(r["overall_score"])
    return {"overall_score": overall, "categories": categories}


def get_scan_record(scan_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        scan = conn.execute(
            """
            SELECT s.id, s.status, s.created_at, s.completed_at, d.url
            FROM scans s
            LEFT JOIN domains d ON d.id = s.domain_id
            WHERE s.id = %s
            """,
            (scan_id,),
        ).fetchone()
        if not scan:
            return None
        findings = conn.execute(
            """
            SELECT category, check_name, clause_reference, status,
                   severity, automatability_type, detail
            FROM findings
            WHERE scan_id = %s
            ORDER BY category, check_name
            """,
            (scan_id,),
        ).fetchall()
        score_rows = conn.execute(
            """
            SELECT category, weighted_score, overall_score
            FROM scores
            WHERE scan_id = %s
            ORDER BY category
            """,
            (scan_id,),
        ).fetchall()

    scores_payload: dict[str, Any] | None = None
    if score_rows:
        cats = []
        overall = None
        for r in score_rows:
            if r["category"] == "overall":
                overall = float(r["overall_score"]) if r["overall_score"] is not None else None
            else:
                cats.append(
                    {
                        "category": r["category"],
                        "score": float(r["weighted_score"])
                        if r["weighted_score"] is not None
                        else 0.0,
                    }
                )
                if overall is None and r["overall_score"] is not None:
                    overall = float(r["overall_score"])
        scores_payload = {"overall_score": overall, "categories": cats}

    return {
        "scan_id": str(scan["id"]),
        "status": scan["status"],
        "url": scan["url"],
        "created_at": scan["created_at"].isoformat() if scan["created_at"] else None,
        "completed_at": scan["completed_at"].isoformat() if scan["completed_at"] else None,
        "findings": [
            {
                "category": r["category"],
                "check_name": r["check_name"],
                "clause_reference": r["clause_reference"],
                "status": r["status"],
                "severity": r["severity"],
                "automatability_type": r["automatability_type"],
                "detail": r["detail"],
            }
            for r in findings
        ],
        "scores": scores_payload,
        "narrative": get_narrative_for_scan(str(scan["id"])),
    }
