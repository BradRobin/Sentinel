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

_ADMIN_PATH_MARKERS = ("admin", "wp-admin", "phpmyadmin")


def _is_admin_style_path(path: str) -> bool:
    return any(marker in path for marker in _ADMIN_PATH_MARKERS)


def _classify_path_exposure(
    path: str, status: int | None, body: str
) -> str | None:
    """
    Return exposure kind, or None if the path does not look exposed.

    - ``content``: real body / config / admin UI reached (hard fail for scoring)
    - ``redirect``: admin-style path returns 3xx only — reachable but not proven open
    """
    if status is None or status in (404, 403, 401, 405, 501):
        return None
    if status >= 500:
        return None

    if status == 200:
        lower = body[:2000].lower()
        if path.startswith("/.git") and ("ref:" in lower or "[core]" in lower):
            return "content"
        if ".env" in path and (
            "=" in body[:500] or "secret" in lower or "key" in lower
        ):
            return "content"
        if _is_admin_style_path(path):
            return "content"
        if "server-status" in path and "apache" in lower:
            return "content"
        if len(body) > 0:
            return "content"
        return None

    # 301/302/303 on admin paths: alive endpoint, not confirmed open panel
    if status in (301, 302, 303) and _is_admin_style_path(path):
        return "redirect"

    return None


def _exposed_files_summary(
    *,
    content: list[dict],
    redirects: list[dict],
) -> str:
    content_paths = ", ".join(str(item["path"]) for item in content)
    redirect_paths = ", ".join(str(item["path"]) for item in redirects)

    if content and redirects:
        return (
            "Sensitive paths returned real content "
            f"({content_paths}). That is a high-risk exposure and should be "
            "blocked. Separately, admin-style paths only redirected "
            f"({redirect_paths}) — those URLs are reachable but not confirmed "
            "open panels; verify they are intentional and access-controlled."
        )
    if content:
        return (
            "Sensitive paths returned real content "
            f"({content_paths}). Configuration, source control, or admin "
            "interfaces should not be publicly reachable — block or remove them."
        )
    if redirects:
        return (
            "Admin-style paths responded with HTTP redirects "
            f"({redirect_paths}), not a confirmed open panel. This usually "
            "means the URL is alive and sends visitors elsewhere (often a "
            "login). An officer should confirm whether these paths should "
            "exist on this site and that access is properly restricted."
        )
    return "No sensitive paths looked publicly exposed."


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

    # 6.4.22 — distinguish confirmed content leaks from redirect-only admin hits
    content_exposed: list[dict] = []
    redirect_exposed: list[dict] = []
    for path, result in snap.path_probes.items():
        if result is None:
            continue
        kind = _classify_path_exposure(path, result.status_code, result.text)
        if kind is None:
            continue
        item = {
            "path": path,
            "status_code": result.status_code,
            "bytes": len(result.text),
            "exposure_kind": kind,
        }
        if kind == "content":
            content_exposed.append(item)
        else:
            redirect_exposed.append(item)

    exposed = content_exposed + redirect_exposed
    summary = _exposed_files_summary(
        content=content_exposed,
        redirects=redirect_exposed,
    )

    if not snap.ok:
        status = FindingStatus.fail
        severity = "high"
        summary = (
            "Could not probe for exposed files because the landing page "
            "fetch failed."
        )
    elif content_exposed:
        status = FindingStatus.fail
        severity = "high"
    elif redirect_exposed:
        # Redirect-only admin URLs need human judgment and must not weight like
        # a confirmed .env / .git / admin UI leak in the numeric score.
        status = FindingStatus.manual_review
        severity = "medium"
    else:
        status = FindingStatus.pass_
        severity = "high"

    findings.append(
        Finding(
            category="security",
            check_name="no_exposed_files",
            clause_reference="6.4.22",
            status=status,
            severity=severity,
            automatability_type="A",
            detail={
                "summary": summary,
                "probed": list(snap.path_probes.keys()),
                "exposed": exposed,
                "content_exposed_count": len(content_exposed),
                "redirect_exposed_count": len(redirect_exposed),
            },
        )
    )

    return findings
