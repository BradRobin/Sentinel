# Clauses 6.4.18.ii–iv, 6.4.19 — Legal & content (A + emit M/P)

from __future__ import annotations

import re

from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus

_PRIVACY_RE = re.compile(
    r"privacy(\s|-|_)*(policy|notice|statement)|data\s+protection",
    re.I,
)
_DISCLAIMER_RE = re.compile(r"disclaimer|terms\s+of\s+(use|service)|legal\s+notice", re.I)
_COOKIE_RE = re.compile(
    r"cookie(\s|-)*(consent|banner|policy|notice|preference)|gdpr|we\s+use\s+cookies",
    re.I,
)


def run_legal_checks(snap: PageSnapshot) -> list[Finding]:
    findings: list[Finding] = []
    html = snap.html
    if not snap.ok:
        for name, clause in (
            ("privacy_policy", "6.4.18.ii"),
            ("cookie_consent", "6.4.18.iii"),
            ("disclaimer", "6.4.18.iv"),
        ):
            findings.append(
                Finding(
                    category="legal_content",
                    check_name=name,
                    clause_reference=clause,
                    status=FindingStatus.fail,
                    severity="medium",
                    automatability_type="A",
                    detail={"error": snap.error or "Page fetch failed"},
                )
            )
        return findings

    # 6.4.18.ii Privacy policy
    privacy_ok = bool(_PRIVACY_RE.search(html))
    findings.append(
        Finding(
            category="legal_content",
            check_name="privacy_policy",
            clause_reference="6.4.18.ii",
            status=FindingStatus.pass_ if privacy_ok else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"linked_or_mentioned": privacy_ok},
        )
    )

    # 6.4.18.iii Cookie consent — if Set-Cookie present, require consent UI signal
    uses_cookies = "set-cookie" in snap.headers or bool(
        re.search(r"document\.cookie|localStorage", html, re.I)
    )
    cookie_ui = bool(_COOKIE_RE.search(html))
    if not uses_cookies:
        cookie_status = FindingStatus.pass_
        cookie_detail = {"cookies_detected": False, "consent_ui": cookie_ui, "note": "No cookie usage signals"}
    else:
        cookie_status = FindingStatus.pass_ if cookie_ui else FindingStatus.fail
        cookie_detail = {"cookies_detected": True, "consent_ui": cookie_ui}

    findings.append(
        Finding(
            category="legal_content",
            check_name="cookie_consent",
            clause_reference="6.4.18.iii",
            status=cookie_status,
            severity="medium",
            automatability_type="A",
            detail=cookie_detail,
        )
    )

    # 6.4.18.iv Disclaimer
    disclaimer_ok = bool(_DISCLAIMER_RE.search(html))
    findings.append(
        Finding(
            category="legal_content",
            check_name="disclaimer",
            clause_reference="6.4.18.iv",
            status=FindingStatus.pass_ if disclaimer_ok else FindingStatus.fail,
            severity="low",
            automatability_type="A",
            detail={"linked_or_mentioned": disclaimer_ok},
        )
    )

    return findings
