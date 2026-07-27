"""
Officer manual review workflow.

Key invariants (v1):
- Scan pipeline never blocks on humans.
- Officer resolutions apply going forward (next scan / latest recompute), not by
  rewriting historical snapshots.
- Pending items are created/upserted automatically when surfaced by scans.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
import json
from typing import Any, Literal

from app.core.database import get_connection
from app.schemas.findings import Finding, FindingStatus


ManualCheckType = Literal["site_inspection", "institutional_attestation"]
ResolvedStatus = Literal["pass", "fail", "flagged"]


@dataclass(frozen=True)
class ManualCheckDef:
    check_name: str
    clause_reference: str
    category: str
    check_type: ManualCheckType
    automatability_type: Literal["A", "P", "M"]
    severity: Literal["high", "medium", "low"]


_MANUAL_CHECK_DEFS: tuple[ManualCheckDef, ...] = (
    ManualCheckDef(
        check_name="domain_not_personal_name",
        clause_reference="6.5.8",
        category="domain_identity",
        check_type="site_inspection",
        automatability_type="P",
        severity="low",
    ),
    ManualCheckDef(
        check_name="image_link_alt",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="media_captions",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="embedded_video_alt",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="no_flashing",
        clause_reference="6.5.12",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="high",
    ),
    ManualCheckDef(
        check_name="responsive_mobile",
        clause_reference="6.5.23",
        category="accessibility",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="coat_of_arms",
        clause_reference="6.5.15",
        category="design_branding",
        check_type="site_inspection",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="g4c_index_structure",
        clause_reference="6.5.16",
        category="design_branding",
        check_type="site_inspection",
        automatability_type="M",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="images_not_distorted",
        clause_reference="6.5.19",
        category="multimedia_performance",
        check_type="site_inspection",
        automatability_type="M",
        severity="low",
    ),
    ManualCheckDef(
        check_name="copyright_attribution",
        clause_reference="6.5.22",
        category="legal_content",
        check_type="site_inspection",
        automatability_type="M",
        severity="low",
    ),
    ManualCheckDef(
        check_name="content_freshness",
        clause_reference="6.5.22",
        category="legal_content",
        check_type="site_inspection",
        automatability_type="P",
        severity="low",
    ),
    # Institutional attestation (no live-site required)
    ManualCheckDef(
        check_name="db_isolation",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="M",
        severity="high",
    ),
    ManualCheckDef(
        check_name="no_malicious_code",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="P",
        severity="high",
    ),
    ManualCheckDef(
        check_name="cms_patched",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="P",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="vuln_scanning_process",
        clause_reference="6.5.25",
        category="security",
        check_type="institutional_attestation",
        automatability_type="M",
        severity="medium",
    ),
    ManualCheckDef(
        check_name="server_side_scripting",
        clause_reference="6.5.14",
        category="design_branding",
        check_type="institutional_attestation",
        automatability_type="P",
        severity="low",
    ),
)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _emit_finding_for_pending(defn: ManualCheckDef) -> Finding:
    return Finding(
        category=defn.category,
        check_name=defn.check_name,
        clause_reference=defn.clause_reference,
        status=FindingStatus.manual_review,
        severity=defn.severity,  # type: ignore[arg-type]
        automatability_type=defn.automatability_type,  # type: ignore[arg-type]
        detail={
            "requires_manual_review": True,
        },
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
        # flagged should not dilute scores; keep manual_review status but mark
        # it as officer-reviewed for transparency.
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


def _upsert_pending_item(
    conn: Any,
    *,
    domain_id: str,
    check_name: str,
    defn: ManualCheckDef,
    scan_id: str,
) -> None:
    """
    Mark the item as pending and clear resolution fields.
    """
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


def emit_manual_review_findings_for_scan(
    scan_id: str,
    *,
    scan_now: date | None = None,
) -> list[Finding]:
    """
    Emit the 16 manual-review findings for this scan, mapping officer resolutions
    into FindingStatus pass/fail/manual_review.
    """
    today = scan_now or _today()
    findings: list[Finding] = []

    with get_connection() as conn:
        scan_row = conn.execute(
            """
            SELECT domain_id
            FROM scans
            WHERE id = %s
            """,
            (scan_id,),
        ).fetchone()
        if not scan_row or not scan_row.get("domain_id"):
            # Should not happen: scans are always created with a domain_id.
            # Still emit pending placeholders so check counts remain stable.
            for defn in _MANUAL_CHECK_DEFS:
                findings.append(_emit_finding_for_pending(defn))
            return findings

        domain_id = str(scan_row["domain_id"])

        for defn in _MANUAL_CHECK_DEFS:
            row = conn.execute(
                """
                SELECT
                    id,
                    current_status,
                    justification,
                    resolved_by,
                    resolved_at,
                    next_review_due,
                    source_scan_id
                FROM manual_review_items
                WHERE domain_id = %s AND check_name = %s
                """,
                (domain_id, defn.check_name),
            ).fetchone()

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
                # Keep it pending, but refresh source_scan_id so the queue panel
                # can link to the most recently surfaced snapshot.
                conn.execute(
                    """
                    UPDATE manual_review_items
                    SET source_scan_id = %s
                    WHERE id = %s
                    """,
                    (scan_id, row["id"]),
                )
                findings.append(_emit_finding_for_pending(defn))
                continue

            next_due = row.get("next_review_due")
            if not next_due or next_due <= today:
                _upsert_pending_item(
                    conn,
                    domain_id=domain_id,
                    check_name=defn.check_name,
                    defn=defn,
                    scan_id=scan_id,
                )
                findings.append(_emit_finding_for_pending(defn))
                continue

            # Resolved and still within cadence window
            justification = row.get("justification")
            resolved_by = row.get("resolved_by")
            resolved_at = row.get("resolved_at")
            resolved_at_iso = (
                resolved_at.isoformat() if isinstance(resolved_at, datetime) else None
            )

            findings.append(
                _emit_finding_for_officer_resolved(
                    defn,
                    current_status=str(current_status),  # type: ignore[arg-type]
                    justification=str(justification) if justification else None,
                    resolved_by=str(resolved_by) if resolved_by else None,
                    resolved_at=resolved_at_iso,
                )
            )

        conn.commit()

    return findings


def resolve_manual_review_item(
    *,
    item_id: str,
    officer_id: str,
    resolved_status: ResolvedStatus,
    justification: str,
) -> dict[str, Any]:
    """
    Resolve a pending item by setting officer status + justification.
    """
    now = datetime.now(timezone.utc)
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                current_status,
                domain_id,
                check_name,
                category,
                check_type
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
            (
                resolved_status,
                justification,
                officer_id,
                now,
                now,
                item_id,
            ),
        )

        # Return updated state
        updated = conn.execute(
            """
            SELECT
                id,
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
                status_updated_at
            FROM manual_review_items
            WHERE id = %s
            """,
            (item_id,),
        ).fetchone()

        if not updated:
            raise RuntimeError("Resolution update failed")

        # Audit log
        conn.execute(
            """
            INSERT INTO audit_log (actor, action, target, metadata)
            VALUES (
                %s,
                'manual_review_resolved',
                %s,
                %s::jsonb
            )
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
                    },
                ),
            ),
        )

        conn.commit()

    return dict(updated)


def requeue_due_manual_review_items() -> int:
    """
    Scheduled job: move items back to pending when cadence window expires.
    """
    today = _today()
    with get_connection() as conn:
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
    officer_id: str | None = None,
    check_type: ManualCheckType | None = None,
    category: str | None = None,
    domain_id: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """
    Queue for officers: list pending items across all domains.
    """
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

    sql = f"""
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
        WHERE {" AND ".join(where)}
        ORDER BY m.status_updated_at ASC
        LIMIT %s
    """
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    out: list[dict[str, Any]] = []
    for r in rows:
        item = dict(r)
        ps = item.get("pending_since")
        if isinstance(ps, datetime):
            item["pending_since"] = ps.isoformat()
        elif ps is None:
            item["pending_since"] = None
        out.append(item)
    return out


def get_manual_review_item(item_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                m.id,
                m.domain_id,
                d.url AS domain_url,
                m.check_name,
                m.category,
                m.check_type,
                s.clause_number AS clause_reference,
                s.title AS question_title,
                m.current_status,
                m.justification,
                m.resolved_by,
                m.resolved_at,
                m.next_review_due,
                m.source_scan_id,
                m.status_updated_at AS pending_since
            FROM manual_review_items m
            JOIN domains d ON d.id = m.domain_id
            JOIN standards_reference s ON s.check_name = m.check_name
            WHERE m.id = %s
            """,
            (item_id,),
        ).fetchone()

    if not row:
        return None

    item = dict(row)
    ps = item.get("pending_since")
    if isinstance(ps, datetime):
        item["pending_since"] = ps.isoformat()
    if item.get("resolved_at") is not None and isinstance(item["resolved_at"], datetime):
        item["resolved_at"] = item["resolved_at"].isoformat()
    if item.get("next_review_due") is not None:
        nr = item["next_review_due"]
        try:
            item["next_review_due"] = nr.isoformat()  # date
        except Exception:
            item["next_review_due"] = str(nr)
    return item

