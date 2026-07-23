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


def create_scan_record(url: str) -> str:
    domain_url = normalize_domain_url(url)
    with get_connection() as conn:
        domain_row = conn.execute(
            """
            INSERT INTO domains (url)
            VALUES (%s)
            ON CONFLICT (url) DO UPDATE SET url = EXCLUDED.url
            RETURNING id
            """,
            (domain_url,),
        ).fetchone()
        domain_id = domain_row["id"]
        scan_row = conn.execute(
            """
            INSERT INTO scans (domain_id, status, triggered_type)
            VALUES (%s, 'queued', 'manual')
            RETURNING id
            """,
            (str(domain_id),),
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
    }
