"""Run the full Phase 2 check suite."""

from __future__ import annotations

from app.checks.accessibility import run_accessibility_checks
from app.checks.design import run_design_checks
from app.checks.domain import run_domain_checks
from app.checks.interoperability import run_interoperability_checks
from app.checks.legal import run_legal_checks
from app.checks.manual_review import emit_manual_review_findings
from app.checks.monitoring import run_monitoring_checks
from app.checks.multimedia import run_multimedia_checks
from app.checks.page import load_page_snapshot
from app.checks.security import _EXPOSED_PATHS, run_security_checks
from app.checks.seo import run_seo_checks
from app.schemas.findings import Finding


def run_all_checks(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> list[Finding]:
    snap = load_page_snapshot(
        url,
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
        probe_paths=_EXPOSED_PATHS,
    )

    findings: list[Finding] = []
    findings.extend(run_domain_checks(url))
    findings.extend(run_security_checks(snap))
    findings.extend(run_interoperability_checks(snap))
    findings.extend(run_accessibility_checks(snap))
    findings.extend(run_design_checks(snap))
    findings.extend(
        run_multimedia_checks(
            snap, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
    )
    findings.extend(run_legal_checks(snap))
    findings.extend(
        run_seo_checks(
            snap, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
    )
    findings.extend(run_monitoring_checks(snap))
    findings.extend(emit_manual_review_findings())
    return findings
