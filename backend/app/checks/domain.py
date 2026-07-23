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


def _check_duplicate(url: str) -> Finding:
    """6.4.5 — Not a duplicate of an already-registered entity (internal registry)."""
    from app.services.scan_repository import normalize_domain_url

    domain_url = normalize_domain_url(url)
    duplicates: list[str] = []
    try:
        from app.core.database import get_connection

        with get_connection() as conn:
            host = urlparse(domain_url).netloc.lower()
            rows2 = conn.execute(
                """
                SELECT url, registered_name FROM domains
                WHERE lower(url) LIKE %s
                """,
                (f"%{host}%",),
            ).fetchall()
            if len(rows2) > 1:
                duplicates = [r["url"] for r in rows2]
            elif rows2 and rows2[0].get("registered_name"):
                name = rows2[0]["registered_name"]
                clash = conn.execute(
                    """
                    SELECT url FROM domains
                    WHERE registered_name = %s AND lower(url) NOT LIKE %s
                    """,
                    (name, f"%{host}%"),
                ).fetchall()
                duplicates = [r["url"] for r in clash]
    except Exception as exc:
        return Finding(
            category="domain_identity",
            check_name="domain_not_duplicate",
            clause_reference="6.4.5",
            status=FindingStatus.manual_review,
            severity="medium",
            automatability_type="A",
            detail={"error": str(exc), "note": "Registry lookup failed"},
        )

    return Finding(
        category="domain_identity",
        check_name="domain_not_duplicate",
        clause_reference="6.4.5",
        status=FindingStatus.pass_ if not duplicates else FindingStatus.fail,
        severity="medium",
        automatability_type="A",
        detail={"url": domain_url, "duplicate_urls": duplicates},
    )


def run_domain_checks(url: str) -> list[Finding]:
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    registrable = _registrable_host(hostname)
    findings: list[Finding] = []

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

    findings.append(_check_duplicate(url))
    return findings
