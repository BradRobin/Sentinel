"""Run the Phase 2 initial check suite."""

from __future__ import annotations

from app.checks.domain import run_domain_checks
from app.checks.security import run_security_checks
from app.checks.seo import run_seo_checks
from app.schemas.findings import Finding


def run_all_checks(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> list[Finding]:
    findings: list[Finding] = []
    findings.extend(run_domain_checks(url))
    findings.extend(
        run_security_checks(
            url, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
        )
    )
    findings.extend(
        run_seo_checks(url, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass)
    )
    return findings
