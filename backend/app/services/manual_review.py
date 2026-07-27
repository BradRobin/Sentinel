"""
Officer manual review workflow.

Key invariants (v1):
- Scan pipeline never blocks on humans.
- Officer resolutions apply going forward (next scan / latest recompute), not by
  rewriting historical snapshots.
- Pending items are created/upserted automatically when surfaced by scans.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
import json
from typing import Any, Literal

from app.core.database import get_connection
from app.data.manual_check_registry import MANUAL_CHECK_DEFS, ManualCheckDef, ManualCheckType
from app.schemas.findings import Finding, FindingStatus

ResolvedStatus = Literal["pass", "fail", "flagged"]

_ITEM_COLUMNS = """
    id,
    current_status,
    justification,
    resolved_by,
    resolved_at,
    next_review_due,
    source_scan_id
"""

_QUEUE_SELECT = """
    SELECT
        m.id,
        m.domain_id,
        d.url AS domain_url,
        m.check_name,
        m.category,
        m.check_type,
        s.clause_number AS clause_reference,
        s.title AS question_title,
        m.status_updated_at AS pending_since,
        m.source_scan_id
    FROM manual_review_items m
    JOIN domains d ON d.id = m.domain_id
    JOIN standards_reference s ON s.check_name = m.check_name
"""


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _normalize_queue_item_row(row: dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    for key in ("id", "domain_id", "source_scan_id", "resolved_by"):
        if item.get(key) is not None:
            item[key] = str(item[key])
    ps = item.get("pending_since")
    if isinstance(ps, datetime):
        item["pending_since"] = ps.isoformat()
    elif ps is None:
        item["pending_since"] = None
    if item.get("resolved_at") is not None and isinstance(item["resolved_at"], datetime):
        item["resolved_at"] = item["resolved_at"].isoformat()
    if item.get("next_review_due") is not None:
        nr = item["next_review_due"]
        try:
            item["next_review_due"] = nr.isoformat()
        except Exception:
            item["next_review_due"] = str(nr)
    return item


def _emit_finding_for_pending(defn: ManualCheckDef) -> Finding:
    return Finding(
        category=defn.category,
        check_name=defn.check_name,
        clause_reference=defn.clause_reference,
        status=FindingStatus.manual_review,
        severity=defn.severity,  # type: ignore[arg-type]
        automatability_type=defn.automatability_type,  # type: ignore[arg-type]
        detail={"requires_manual_review": True},
    )


def _emit_finding_for_officer_resolved(
    defn: ManualCheckDef,
    *,
    current_status: ResolvedStatus,
    justification: str | None,
    resolved_by: str | None,
    resolved_at: str | None,
) -> Finding:
    if current_status == "pass":
        status = FindingStatus.pass_
    elif current_status == "fail":
        status = FindingStatus.fail
    else:
        status = FindingStatus.manual_review

    return Finding(
        category=defn.category,
        check_name=defn.check_name,
        clause_reference=defn.clause_reference,
        status=status,
        severity=defn.severity,  # type: ignore[arg-type]
        automatability_type=defn.automatability_type,  # type: ignore[arg-type]
        detail={
            "officer_reviewed": True,
            "officer_resolution_status": current_status,
            "officer_justification": justification,
            "resolved_by": resolved_by,
            "resolved_at": resolved_at,
        },
    )


def _fetch_items_for_domain(conn: Any, domain_id: str) -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        f"""
        SELECT {_ITEM_COLUMNS}
        FROM manual_review_items
        WHERE domain_id = %s
        """,
        (domain_id,),
    ).fetchall()
    return {str(r["check_name"]): dict(r) for r in rows}


def _upsert_pending_item(
    conn: Any,
    *,
    domain_id: str,
    check_name: str,
    defn: ManualCheckDef,
    scan_id: str,
) -> None:
    """Insert or reset an item to pending (clears prior resolution fields)."""
    conn.execute(
        """
        INSERT INTO manual_review_items (
            domain_id,
            check_name,
            category,
            check_type,
            current_status,
            justification,
            resolved_by,
            resolved_at,
            next_review_due,
            source_scan_id,
            status_updated_at,
            created_at
        ) VALUES (
            %s, %s, %s, %s,
            'pending'::manual_review_status,
            NULL, NULL, NULL, NULL,
            %s,
            now(), now()
        )
        ON CONFLICT (domain_id, check_name) DO UPDATE SET
            current_status = 'pending'::manual_review_status,
            justification = NULL,
            resolved_by = NULL,
            resolved_at = NULL,
            next_review_due = NULL,
            source_scan_id = EXCLUDED.source_scan_id,
            status_updated_at = now()
        """,
        (domain_id, check_name, defn.category, defn.check_type, scan_id),
    )


def _touch_pending_source_scans(
    conn: Any,
    *,
    item_ids: list[str],
    scan_id: str,
) -> None:
    if not item_ids:
        return
    conn.execute(
        """
        UPDATE manual_review_items
        SET source_scan_id = %s
        WHERE id = ANY(%s::uuid[])
        """,
        (scan_id, item_ids),
    )


def _log_cadence_requeue(
    conn: Any,
    *,
    item_id: str,
    domain_id: str,
    check_name: str,
    prior_status: str,
    scan_id: str,
    actor: str = "system:cadence",
) -> None:
    conn.execute(
        """
        INSERT INTO audit_log (actor, action, target, metadata)
        VALUES (%s, 'manual_review_cadence_requeue', %s, %s::jsonb)
        """,
        (
            actor,
            item_id,
            json.dumps(
                {
                    "item_id": item_id,
                    "domain_id": domain_id,
                    "check_name": check_name,
                    "prior_status": prior_status,
                    "source_scan_id": scan_id,
                }
            ),
        ),
    )


def emit_manual_review_findings_for_scan(
    scan_id: str,
    *,
    scan_now: date | None = None,
) -> list[Finding]:
    """
    Emit manual-review findings for this scan, mapping officer resolutions
    into FindingStatus pass/fail/manual_review.
    """
    today = scan_now or _today()
    findings: list[Finding] = []

    with get_connection() as conn:
        scan_row = conn.execute(
            "SELECT domain_id FROM scans WHERE id = %s",
            (scan_id,),
        ).fetchone()
        if not scan_row or not scan_row.get("domain_id"):
            for defn in MANUAL_CHECK_DEFS:
                findings.append(_emit_finding_for_pending(defn))
            return findings

        domain_id = str(scan_row["domain_id"])
        existing = _fetch_items_for_domain(conn, domain_id)
        pending_touch_ids: list[str] = []

        for defn in MANUAL_CHECK_DEFS:
            row = existing.get(defn.check_name)

            if not row:
                _upsert_pending_item(
                    conn,
                    domain_id=domain_id,
                    check_name=defn.check_name,
                    defn=defn,
                    scan_id=scan_id,
                )
                findings.append(_emit_finding_for_pending(defn))
                continue

            current_status = str(row["current_status"])

            if current_status == "pending":
                pending_touch_ids.append(str(row["id"]))
                findings.append(_emit_finding_for_pending(defn))
                continue

            next_due = row.get("next_review_due")
            if not next_due or next_due <= today:
                _log_cadence_requeue(
                    conn,
                    item_id=str(row["id"]),
                    domain_id=domain_id,
                    check_name=defn.check_name,
                    prior_status=current_status,
                    scan_id=scan_id,
                )
                _upsert_pending_item(
                    conn,
                    domain_id=domain_id,
                    check_name=defn.check_name,
                    defn=defn,
                    scan_id=scan_id,
                )
                findings.append(_emit_finding_for_pending(defn))
                continue

            resolved_at = row.get("resolved_at")
            resolved_at_iso = (
                resolved_at.isoformat() if isinstance(resolved_at, datetime) else None
            )
            findings.append(
                _emit_finding_for_officer_resolved(
                    defn,
                    current_status=current_status,  # type: ignore[arg-type]
                    justification=str(row["justification"])
                    if row.get("justification")
                    else None,
                    resolved_by=str(row["resolved_by"])
                    if row.get("resolved_by")
                    else None,
                    resolved_at=resolved_at_iso,
                )
            )

        _touch_pending_source_scans(conn, item_ids=pending_touch_ids, scan_id=scan_id)
        conn.commit()

    return findings


def resolve_manual_review_item(
    *,
    item_id: str,
    officer_id: str,
    resolved_status: ResolvedStatus,
    justification: str,
) -> dict[str, Any]:
    """Resolve a pending item by setting officer status + justification."""
    now = datetime.now(timezone.utc)
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, current_status, domain_id, check_name, category, check_type
            FROM manual_review_items
            WHERE id = %s
            """,
            (item_id,),
        ).fetchone()
        if not row:
            raise ValueError("manual_review_items row not found")

        if str(row["current_status"]) != "pending":
            raise ValueError("manual_review_items is not pending")

        conn.execute(
            """
            UPDATE manual_review_items
            SET current_status = %s::manual_review_status,
                justification = %s,
                resolved_by = %s,
                resolved_at = %s,
                next_review_due = ( (%s::timestamptz) + interval '3 months' )::date,
                status_updated_at = now()
            WHERE id = %s
            """,
            (resolved_status, justification, officer_id, now, now, item_id),
        )

        updated = conn.execute(
            f"""
            SELECT
                id, domain_id, check_name, category, check_type,
                current_status, justification, resolved_by, resolved_at,
                next_review_due, source_scan_id, status_updated_at
            FROM manual_review_items
            WHERE id = %s
            """,
            (item_id,),
        ).fetchone()

        if not updated:
            raise RuntimeError("Resolution update failed")

        conn.execute(
            """
            INSERT INTO audit_log (actor, action, target, metadata)
            VALUES (%s, 'manual_review_resolved', %s, %s::jsonb)
            """,
            (
                officer_id,
                str(updated["id"]),
                json.dumps(
                    {
                        "item_id": str(updated["id"]),
                        "domain_id": str(updated["domain_id"]),
                        "check_name": str(updated["check_name"]),
                        "resolved_status": str(updated["current_status"]),
                        "justification": updated["justification"],
                        "resolved_at": (
                            updated["resolved_at"].isoformat()
                            if isinstance(updated["resolved_at"], datetime)
                            else None
                        ),
                        "next_review_due": (
                            updated["next_review_due"].isoformat()
                            if updated["next_review_due"]
                            else None
                        ),
                    }
                ),
            ),
        )

        conn.commit()

    return dict(updated)


def requeue_due_manual_review_items() -> int:
    """Scheduled job: move items back to pending when cadence window expires."""
    today = _today()
    with get_connection() as conn:
        due_rows = conn.execute(
            """
            SELECT id, domain_id, check_name, current_status
            FROM manual_review_items
            WHERE next_review_due IS NOT NULL
              AND next_review_due <= %s
              AND current_status IN (
                'pass'::manual_review_status,
                'fail'::manual_review_status,
                'flagged'::manual_review_status
              )
            """,
            (today,),
        ).fetchall()

        for row in due_rows:
            _log_cadence_requeue(
                conn,
                item_id=str(row["id"]),
                domain_id=str(row["domain_id"]),
                check_name=str(row["check_name"]),
                prior_status=str(row["current_status"]),
                scan_id="",
                actor="system:scheduled_requeue",
            )

        res = conn.execute(
            """
            UPDATE manual_review_items
            SET current_status = 'pending'::manual_review_status,
                justification = NULL,
                resolved_by = NULL,
                resolved_at = NULL,
                next_review_due = NULL,
                source_scan_id = NULL,
                status_updated_at = now()
            WHERE next_review_due IS NOT NULL
              AND next_review_due <= %s
              AND current_status IN (
                'pass'::manual_review_status,
                'fail'::manual_review_status,
                'flagged'::manual_review_status
              )
            RETURNING id
            """,
            (today,),
        ).fetchall()
        conn.commit()
        return len(res)


def list_pending_manual_review_items(
    *,
    check_type: ManualCheckType | None = None,
    category: str | None = None,
    domain_id: str | None = None,
    domain_query: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Queue for officers: list pending items across all domains."""
    limit = max(1, min(int(limit), 500))
    where: list[str] = ["m.current_status = 'pending'::manual_review_status"]
    params: list[Any] = []

    if check_type:
        where.append("m.check_type = %s")
        params.append(check_type)
    if category:
        where.append("m.category = %s")
        params.append(category)
    if domain_id:
        where.append("m.domain_id = %s")
        params.append(domain_id)
    q = (domain_query or "").strip()
    if q:
        where.append("lower(d.url) LIKE %s")
        params.append(f"%{q.lower()}%")

    sql = f"""
        {_QUEUE_SELECT}
        WHERE {" AND ".join(where)}
        ORDER BY m.status_updated_at ASC
        LIMIT %s
    """
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    return [_normalize_queue_item_row(dict(r)) for r in rows]


def get_manual_review_item(item_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
                m.id,
                m.domain_id,
                d.url AS domain_url,
                m.check_name,
                m.category,
                m.check_type,
                s.clause_number AS clause_reference,
                s.title AS question_title,
                m.status_updated_at AS pending_since,
                m.source_scan_id,
                m.current_status,
                m.justification,
                m.resolved_by,
                m.resolved_at,
                m.next_review_due
            FROM manual_review_items m
            JOIN domains d ON d.id = m.domain_id
            JOIN standards_reference s ON s.check_name = m.check_name
            WHERE m.id = %s
            """,
            (item_id,),
        ).fetchone()

    if not row:
        return None

    return _normalize_queue_item_row(dict(row))
