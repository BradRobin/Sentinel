"""Run the full Phase 2 check suite with optional progress callbacks."""

from __future__ import annotations

from collections.abc import Callable

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

ProgressCallback = Callable[[str], None]

# Human-readable labels for SRS §8.4 processing state
CATEGORY_LABELS: dict[str, str] = {
    "fetch": "Fetching page…",
    "domain_identity": "Checking domain identity…",
    "security": "Checking security…",
    "interoperability": "Checking interoperability…",
    "accessibility": "Checking accessibility…",
    "design_branding": "Checking design and branding…",
    "multimedia_performance": "Checking multimedia and performance…",
    "legal_content": "Checking legal and content…",
    "seo": "Checking SEO and visibility…",
    "monitoring": "Checking site availability…",
    "manual_review": "Recording items that need manual review…",
    "complete": "Scan complete",
}


def run_all_checks(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    on_progress: ProgressCallback | None = None,
) -> list[Finding]:
    def progress(key: str) -> None:
        if on_progress:
            on_progress(CATEGORY_LABELS.get(key, key))

    progress("fetch")
    snap = load_page_snapshot(
        url,
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
        probe_paths=_EXPOSED_PATHS,
    )

    findings: list[Finding] = []

    progress("domain_identity")
    findings.extend(run_domain_checks(url))

    progress("security")
    findings.extend(run_security_checks(snap))

    progress("interoperability")
    findings.extend(run_interoperability_checks(snap))

    progress("accessibility")
    findings.extend(run_accessibility_checks(snap))

    progress("design_branding")
    findings.extend(run_design_checks(snap))

    progress("multimedia_performance")
    findings.extend(
        run_multimedia_checks(
            snap, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
    )

    progress("legal_content")
    findings.extend(run_legal_checks(snap))

    progress("seo")
    findings.extend(
        run_seo_checks(
            snap, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
    )

    progress("monitoring")
    findings.extend(run_monitoring_checks(snap))

    progress("manual_review")
    findings.extend(emit_manual_review_findings())

    progress("complete")
    return findings
