# Clauses 6.4.4 / 6.4.5 — Domain format and identity rules

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.schemas.findings import Finding, FindingStatus

_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")


def _registrable_host(hostname: str) -> str:
    """Hostname with .go.ke / .gov.ke suffix removed for label rules."""
    host = hostname.lower().rstrip(".")
    for tld in (".go.ke", ".gov.ke"):
        if host.endswith(tld):
            return host[: -len(tld)]
    return host


def run_domain_checks(url: str) -> list[Finding]:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    registrable = _registrable_host(hostname)
    findings: list[Finding] = []

    # 6.4.4 — TLD
    tld_ok = hostname.endswith(".go.ke") or hostname.endswith(".gov.ke")
    findings.append(
        Finding(
            category="domain_identity",
            check_name="domain_tld",
            clause_reference="6.4.4",
            status=FindingStatus.pass_ if tld_ok else FindingStatus.fail,
            severity="high",
            automatability_type="A",
            detail={"hostname": hostname, "allowed_suffixes": [".go.ke", ".gov.ke"]},
        )
    )

    # 6.4.4 — length ≤ 40 (full hostname per SRS domain string)
    length_ok = len(hostname) <= 40
    findings.append(
        Finding(
            category="domain_identity",
            check_name="domain_length",
            clause_reference="6.4.4",
            status=FindingStatus.pass_ if length_ok else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"hostname": hostname, "length": len(hostname), "max": 40},
        )
    )

    # 6.4.4 — not entirely numeric
    not_numeric = not registrable.replace(".", "").replace("-", "").isdigit()
    findings.append(
        Finding(
            category="domain_identity",
            check_name="domain_not_numeric",
            clause_reference="6.4.4",
            status=FindingStatus.pass_ if not_numeric else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"registrable_part": registrable},
        )
    )

    # 6.4.4 — letters/numbers/hyphens; no leading/trailing hyphen; max one hyphen per label
    labels = registrable.split(".")
    format_issues: list[str] = []
    for label in labels:
        if not label:
            format_issues.append("empty label")
            continue
        if label.startswith("-") or label.endswith("-"):
            format_issues.append(f"label '{label}' has leading/trailing hyphen")
        if label.count("-") > 1:
            format_issues.append(f"label '{label}' has more than one hyphen")
        if not _LABEL_RE.match(label):
            format_issues.append(f"label '{label}' has invalid characters")

    format_ok = len(format_issues) == 0
    findings.append(
        Finding(
            category="domain_identity",
            check_name="domain_format",
            clause_reference="6.4.4",
            status=FindingStatus.pass_ if format_ok else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={"registrable_part": registrable, "issues": format_issues},
        )
    )

    return findings
