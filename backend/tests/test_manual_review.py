"""Officer manual review workflow tests."""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.data.manual_check_registry import MANUAL_CHECK_DEFS, MANUAL_CHECK_NAMES
from app.schemas.findings import FindingStatus
from app.services.manual_review import (
    emit_manual_review_findings_for_scan,
    requeue_due_manual_review_items,
    resolve_manual_review_item,
)


def _mock_conn(*, fetchone=None, fetchall=None, execute_side_effect=None):
    conn = MagicMock()
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    if execute_side_effect is not None:
        conn.execute.side_effect = execute_side_effect
    else:
        conn.execute.return_value.fetchone.return_value = fetchone
        conn.execute.return_value.fetchall.return_value = fetchall or []
    return conn


def test_manual_check_registry_covers_sixteen_items():
    assert len(MANUAL_CHECK_DEFS) == 16
    assert "domain_semantic_relevance" not in MANUAL_CHECK_NAMES
    assert "db_isolation" in MANUAL_CHECK_NAMES


def test_emit_creates_pending_findings_when_no_rows():
    domain_id = "dom-1"
    scan_id = "scan-1"

    def side_effect(sql, params=None):
        result = MagicMock()
        if "FROM scans" in sql:
            result.fetchone.return_value = {"domain_id": domain_id}
        elif "FROM manual_review_items" in sql and "WHERE domain_id" in sql:
            result.fetchall.return_value = []
        else:
            result.fetchone.return_value = None
            result.fetchall.return_value = []
        return result

    conn = _mock_conn(execute_side_effect=side_effect)
    with patch("app.services.manual_review.get_connection", return_value=conn):
        findings = emit_manual_review_findings_for_scan(scan_id)

    assert len(findings) == 16
    assert all(f.status == FindingStatus.manual_review for f in findings)
    assert conn.execute.call_count >= 17  # scan + batch select + 16 upserts


def test_emit_uses_officer_pass_within_cadence():
    domain_id = "dom-1"
    scan_id = "scan-2"
    future = date(2099, 1, 1)
    resolved_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    rows = [
        {
            "id": "item-1",
            "check_name": MANUAL_CHECK_DEFS[0].check_name,
            "current_status": "pass",
            "justification": "Looks fine",
            "resolved_by": "off-1",
            "resolved_at": resolved_at,
            "next_review_due": future,
            "source_scan_id": "old-scan",
        }
    ]

    def side_effect(sql, params=None):
        result = MagicMock()
        if "FROM scans" in sql:
            result.fetchone.return_value = {"domain_id": domain_id}
        elif "FROM manual_review_items" in sql and "WHERE domain_id" in sql:
            result.fetchall.return_value = rows
        else:
            result.fetchone.return_value = None
            result.fetchall.return_value = []
        return result

    conn = _mock_conn(execute_side_effect=side_effect)
    with patch("app.services.manual_review.get_connection", return_value=conn):
        findings = emit_manual_review_findings_for_scan(
            scan_id, scan_now=date(2026, 7, 1)
        )

    by_name = {f.check_name: f for f in findings}
    passed = by_name[MANUAL_CHECK_DEFS[0].check_name]
    assert passed.status == FindingStatus.pass_
    assert passed.detail.get("officer_reviewed") is True
    assert len(findings) == 16


def test_emit_requeues_when_cadence_expired():
    domain_id = "dom-1"
    scan_id = "scan-3"
    past = date(2020, 1, 1)

    rows = [
        {
            "id": "item-2",
            "check_name": MANUAL_CHECK_DEFS[1].check_name,
            "current_status": "fail",
            "justification": "Bad captions",
            "resolved_by": "off-1",
            "resolved_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
            "next_review_due": past,
            "source_scan_id": "old-scan",
        }
    ]

    audit_calls: list[str] = []

    def side_effect(sql, params=None):
        result = MagicMock()
        if "FROM scans" in sql:
            result.fetchone.return_value = {"domain_id": domain_id}
        elif "FROM manual_review_items" in sql and "WHERE domain_id" in sql:
            result.fetchall.return_value = rows
        elif "INSERT INTO audit_log" in sql:
            audit_calls.append(sql)
            result.fetchone.return_value = None
            result.fetchall.return_value = []
        else:
            result.fetchone.return_value = None
            result.fetchall.return_value = []
        return result

    conn = _mock_conn(execute_side_effect=side_effect)
    with patch("app.services.manual_review.get_connection", return_value=conn):
        findings = emit_manual_review_findings_for_scan(
            scan_id, scan_now=date(2026, 7, 1)
        )

    by_name = {f.check_name: f for f in findings}
    assert by_name[MANUAL_CHECK_DEFS[1].check_name].status == FindingStatus.manual_review
    assert audit_calls


def test_resolve_manual_review_item_rejects_non_pending():
    conn = _mock_conn(
        fetchone={
            "id": "item-1",
            "current_status": "pass",
            "domain_id": "dom",
            "check_name": "db_isolation",
            "category": "security",
            "check_type": "institutional_attestation",
        }
    )
    with patch("app.services.manual_review.get_connection", return_value=conn):
        with pytest.raises(ValueError, match="not pending"):
            resolve_manual_review_item(
                item_id="item-1",
                officer_id="off-1",
                resolved_status="pass",
                justification="Valid long enough text",
            )


def test_requeue_due_manual_review_items_returns_count():
    conn = _mock_conn()
    conn.execute.side_effect = [
        MagicMock(
            fetchall=MagicMock(
                return_value=[
                    {
                        "id": "a",
                        "domain_id": "d",
                        "check_name": "db_isolation",
                        "current_status": "pass",
                    }
                ]
            )
        ),
        MagicMock(fetchone=MagicMock(return_value=None)),
        MagicMock(fetchall=MagicMock(return_value=[{"id": "a"}])),
    ]
    with patch("app.services.manual_review.get_connection", return_value=conn):
        count = requeue_due_manual_review_items()
    assert count == 1
