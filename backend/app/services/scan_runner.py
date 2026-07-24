"""Run the full Phase 2 check suite with optional progress callbacks."""

from __future__ import annotations

from collections.abc import Callable

from app.checks.accessibility import run_accessibility_checks
from app.checks.design import run_design_checks
from app.checks.domain import run_domain_checks
from app.checks.domain_semantic import run_domain_semantic_check
from app.checks.interoperability import run_interoperability_checks
from app.checks.legal import run_legal_checks
from app.checks.manual_review import emit_manual_review_findings
from app.checks.monitoring import run_monitoring_checks
from app.checks.multimedia import run_multimedia_checks
from app.checks.page import load_page_snapshot
from app.checks.security import _EXPOSED_PATHS, run_security_checks
from app.checks.seo import run_seo_checks
from app.schemas.findings import Finding

# Scored categories in scoring_weights / SRS display order (monitoring excluded)
SCORED_PROGRESS_CATEGORIES: tuple[str, ...] = (
    "domain_identity",
    "security",
    "interoperability",
    "accessibility",
    "design_branding",
    "multimedia_performance",
    "legal_content",
    "seo",
)

TOTAL_SCORED_CATEGORIES = len(SCORED_PROGRESS_CATEGORIES)

# Human-readable labels for processing state (API / logs); UI may map keys itself
CATEGORY_LABELS: dict[str, str] = {
    "domain_identity": "Checking domain identity…",
    "security": "Checking security…",
    "interoperability": "Checking interoperability…",
    "accessibility": "Checking accessibility…",
    "design_branding": "Checking design and branding…",
    "multimedia_performance": "Checking multimedia and performance…",
    "legal_content": "Checking legal and content…",
    "seo": "Checking SEO and visibility…",
}

# current_category, categories_completed, findings_so_far (scored categories only)
ProgressCallback = Callable[[str | None, list[str], list[Finding]], None]


def run_all_checks(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
    on_progress: ProgressCallback | None = None,
) -> list[Finding]:
    """
    Run checks in scoring order.

    ``on_progress(current_category, categories_completed, findings_so_far)``
    is invoked immediately *before* each scored category starts, and again
    after it finishes (so ``categories_completed`` advances while the
    category key is still current). ``findings_so_far`` includes only
    findings from completed scored categories. Fetch / monitoring /
    manual_review are not part of the scored progress sequence.
    """

    def report(current: str | None, completed: list[str], so_far: list[Finding]) -> None:
        if on_progress:
            on_progress(current, list(completed), list(so_far))

    # Fetch phase: no current_category yet (UI stays on Queued…)
    snap = load_page_snapshot(
        url,
        allowed_tlds=allowed_tlds,
        allow_tld_bypass=allow_tld_bypass,
        probe_paths=_EXPOSED_PATHS,
    )

    findings: list[Finding] = []
    completed: list[str] = []

    runners: list[tuple[str, Callable[[], list[Finding]]]] = [
        (
            "domain_identity",
            lambda: [
                *run_domain_checks(url),
                *run_domain_semantic_check(url, snap),
            ],
        ),
        ("security", lambda: run_security_checks(snap)),
        ("interoperability", lambda: run_interoperability_checks(snap)),
        ("accessibility", lambda: run_accessibility_checks(snap)),
        ("design_branding", lambda: run_design_checks(snap)),
        (
            "multimedia_performance",
            lambda: run_multimedia_checks(
                snap, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
            ),
        ),
        ("legal_content", lambda: run_legal_checks(snap)),
        (
            "seo",
            lambda: run_seo_checks(
                snap, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
            ),
        ),
    ]

    for category, runner in runners:
        report(category, completed, findings)
        findings.extend(runner())
        completed.append(category)
        report(category, completed, findings)

    # Excluded from scored progress sequence
    findings.extend(run_monitoring_checks(snap))
    findings.extend(emit_manual_review_findings())

    return findings
