# Clause 6.4.18.i — HTTPS enforced, valid certificate
# Clause 6.4.21 — Security headers (HSTS, CSP, X-Frame-Options)

from __future__ import annotations

from urllib.parse import urlparse

import httpx

from app.checks.fetcher import check_tls_certificate, fetch_url, origin_https_url
from app.schemas.findings import Finding, FindingStatus


def run_security_checks(
    url: str,
    *,
    allowed_tlds: list[str] | None = None,
    allow_tld_bypass: bool = False,
) -> list[Finding]:
    findings: list[Finding] = []
    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    # --- 6.4.18.i HTTPS valid certificate ---
    https_url = origin_https_url(url) if parsed.scheme == "http" else url
    cert = check_tls_certificate(hostname)
    https_enforced = parsed.scheme == "https"

    try:
        if parsed.scheme == "http":
            probe = fetch_url(
                https_url,
                allowed_tlds=allowed_tlds,
                allow_tld_bypass=allow_tld_bypass,
            )
            https_enforced = probe.status_code < 400
            page_headers = probe.headers
            page_status = probe.status_code
        else:
            probe = fetch_url(
                url, allowed_tlds=allowed_tlds, allow_tld_bypass=allow_tld_bypass
            )
            page_headers = probe.headers
            page_status = probe.status_code
    except httpx.HTTPError as exc:
        findings.append(
            Finding(
                category="security",
                check_name="https_valid_cert",
                clause_reference="6.4.18.i",
                status=FindingStatus.fail,
                severity="high",
                automatability_type="A",
                detail={
                    "url": url,
                    "https_enforced": https_enforced,
                    "certificate_valid": cert.valid,
                    "certificate_error": cert.error,
                    "fetch_error": str(exc),
                },
            )
        )
        findings.append(
            Finding(
                category="security",
                check_name="security_headers",
                clause_reference="6.4.21",
                status=FindingStatus.fail,
                severity="medium",
                automatability_type="A",
                detail={"error": "Could not fetch page to inspect headers", "message": str(exc)},
            )
        )
        return findings

    cert_ok = cert.valid and https_enforced
    findings.append(
        Finding(
            category="security",
            check_name="https_valid_cert",
            clause_reference="6.4.18.i",
            status=FindingStatus.pass_ if cert_ok else FindingStatus.fail,
            severity="high",
            automatability_type="A",
            detail={
                "url": url,
                "https_enforced": https_enforced,
                "certificate_valid": cert.valid,
                "certificate_expires_at": cert.expires_at,
                "certificate_error": cert.error,
                "http_status": page_status,
            },
        )
    )

    # --- 6.4.21 Security headers ---
    required = {
        "strict-transport-security": "HSTS",
        "content-security-policy": "CSP",
        "x-frame-options": "X-Frame-Options",
    }
    present = {key: key in page_headers for key in required}
    missing = [label for key, label in required.items() if not present[key]]

    findings.append(
        Finding(
            category="security",
            check_name="security_headers",
            clause_reference="6.4.21",
            status=FindingStatus.pass_ if not missing else FindingStatus.fail,
            severity="medium",
            automatability_type="A",
            detail={
                "present": present,
                "missing": missing,
                "sample_headers": {k: page_headers.get(k) for k in present if present[k]},
            },
        )
    )

    return findings
