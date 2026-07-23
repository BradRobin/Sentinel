# Clause 6.4.18.i — HTTPS enforced, valid certificate
# Clause 6.4.21 — Security headers (HSTS, CSP, X-Frame-Options)
# Clause 6.4.22 — No exposed root/critical files

from __future__ import annotations

from urllib.parse import urlparse

from app.checks.page import PageSnapshot
from app.schemas.findings import Finding, FindingStatus

_EXPOSED_PATHS = [
    "/.git/HEAD",
    "/.git/config",
    "/.env",
    "/.env.local",
    "/.env.production",
    "/wp-admin/",
    "/admin/",
    "/administrator/",
    "/phpmyadmin/",
    "/server-status",
]


def _path_looks_exposed(path: str, status: int | None, body: str) -> bool:
    if status is None or status in (404, 403, 401, 405, 501):
        return False
    if status >= 500:
        return False
    # 200 with telltale content
    if status == 200:
        lower = body[:2000].lower()
        if path.startswith("/.git") and ("ref:" in lower or "[core]" in lower):
            return True
        if ".env" in path and ("=" in body[:500] or "secret" in lower or "key" in lower):
            return True
        if any(p in path for p in ("admin", "phpmyadmin", "wp-admin")):
            # login form / dashboard markers
            if any(x in lower for x in ("login", "password", "dashboard", "wp-login", "phpmyadmin")):
                return True
            return True  # reachable admin path is enough to flag
        if "server-status" in path and "apache" in lower:
            return True
        return status == 200 and len(body) > 0
    # 301/302 to a real admin area still suspicious
    if status in (301, 302, 303) and any(p in path for p in ("admin", "wp-admin", "phpmyadmin")):
        return True
    return False


def run_security_checks(snap: PageSnapshot) -> list[Finding]:
    findings: list[Finding] = []
    parsed = urlparse(snap.request_url)
    https_enforced = parsed.scheme == "https"

    if not snap.ok:
        findings.append(
            Finding(
                category="security",
                check_name="https_valid_cert",
                clause_reference="6.4.18.i",
                status=FindingStatus.fail,
                severity="high",
                automatability_type="A",
                detail={
                    "url": snap.request_url,
                    "https_enforced": https_enforced,
                    "certificate_valid": snap.cert_valid,
                    "certificate_error": snap.cert_error,
                    "fetch_error": snap.error,
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
                detail={"error": snap.error or "Could not fetch page"},
            )
        )
    else:
        cert_ok = snap.cert_valid and https_enforced
        findings.append(
            Finding(
                category="security",
                check_name="https_valid_cert",
                clause_reference="6.4.18.i",
                status=FindingStatus.pass_ if cert_ok else FindingStatus.fail,
                severity="high",
                automatability_type="A",
                detail={
                    "url": snap.request_url,
                    "https_enforced": https_enforced,
                    "certificate_valid": snap.cert_valid,
                    "certificate_expires_at": snap.cert_expires_at,
                    "certificate_error": snap.cert_error,
                    "http_status": snap.status_code,
                },
            )
        )

        required = {
            "strict-transport-security": "HSTS",
            "content-security-policy": "CSP",
            "x-frame-options": "X-Frame-Options",
        }
        # CSP frame-ancestors can substitute for X-Frame-Options
        present = {key: key in snap.headers for key in required}
        csp = snap.headers.get("content-security-policy", "")
        if "frame-ancestors" in csp.lower():
            present["x-frame-options"] = True
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
                    "sample_headers": {
                        k: snap.headers.get(k) for k in present if present[k]
                    },
                },
            )
        )

    # 6.4.22 exposed files — from path probes on snapshot
    exposed: list[dict] = []
    for path, result in snap.path_probes.items():
        if result is None:
            continue
        if _path_looks_exposed(path, result.status_code, result.text):
            exposed.append(
                {
                    "path": path,
                    "status_code": result.status_code,
                    "bytes": len(result.text),
                }
            )

    findings.append(
        Finding(
            category="security",
            check_name="no_exposed_files",
            clause_reference="6.4.22",
            status=FindingStatus.pass_ if not exposed else FindingStatus.fail,
            severity="high",
            automatability_type="A",
            detail={
                "probed": list(snap.path_probes.keys()),
                "exposed": exposed,
            },
        )
    )

    return findings
