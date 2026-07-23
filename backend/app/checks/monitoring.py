# Clause 6.4.23 — Site availability / uptime (feeds monitoring; A)

from __future__ import annotations

from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus


def run_monitoring_checks(snap: PageSnapshot) -> list[Finding]:
    available = snap.ok and snap.status_code is not None and snap.status_code < 500
    return [
        Finding(
            category="monitoring",
            check_name="site_availability",
            clause_reference="6.4.23",
            status=FindingStatus.pass_ if available else FindingStatus.fail,
            severity="high",
            automatability_type="A",
            detail={
                "available": available,
                "http_status": snap.status_code,
                "error": snap.error,
                "elapsed_ms": snap.elapsed_ms,
                "note": "Point-in-time availability at scan; not a historical uptime SLA",
            },
        )
    ]
