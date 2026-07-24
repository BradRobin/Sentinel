"""Clause 6.4.4 — Domain bears semantic connection to stated purpose (LLM judgment)."""

from __future__ import annotations

from urllib.parse import urlparse

from app.checks.page import PageSnapshot
from app.checks.seo import _parse_head
from app.schemas.findings import Finding, FindingStatus
from app.services.ai.domain_semantic import judge_domain_semantic_relevance
from app.services.scan_repository import normalize_domain_url


def _lookup_org_context(url: str) -> dict[str, str | None]:
    """Load MCDA org fields linked to this domain, if registered."""
    domain_url = normalize_domain_url(url)
    empty = {
        "org_name": None,
        "org_type": None,
        "org_sector": None,
        "registered_name": None,
        "stated_purpose": None,
    }
    try:
        from app.core.database import get_connection

        with get_connection() as conn:
            host = (urlparse(domain_url).netloc or "").lower()
            row = conn.execute(
                """
                SELECT d.registered_name, o.name AS org_name, o.type AS org_type,
                       o.sector AS org_sector
                FROM domains d
                LEFT JOIN organizations o ON o.id = d.org_id
                WHERE lower(d.url) LIKE %s
                ORDER BY d.added_at ASC
                LIMIT 1
                """,
                (f"%{host}%",),
            ).fetchone()
    except Exception:
        return empty

    if not row:
        return empty

    org_name = row.get("org_name")
    org_type = row.get("org_type")
    org_sector = row.get("org_sector")
    registered = row.get("registered_name")

    # Stated purpose is not a dedicated column yet — compose from MCDA identity fields.
    purpose_parts = [p for p in (org_name, org_type, org_sector) if p]
    stated_purpose = None
    if purpose_parts:
        stated_purpose = " · ".join(str(p) for p in purpose_parts)
    elif registered:
        stated_purpose = str(registered)

    return {
        "org_name": org_name,
        "org_type": str(org_type) if org_type else None,
        "org_sector": org_sector,
        "registered_name": registered,
        "stated_purpose": stated_purpose,
    }


def run_domain_semantic_check(url: str, snap: PageSnapshot | None = None) -> list[Finding]:
    """
    Resolve domain_semantic_relevance via Claude when configured.

    Returns a single Finding; status maps flag → manual_review.
    """
    html = snap.html if snap else ""
    title, description, _robots = _parse_head(html) if html else (None, None, None)
    ctx = _lookup_org_context(url)

    judgment = judge_domain_semantic_relevance(
        url=url,
        stated_purpose=ctx.get("stated_purpose"),
        org_name=ctx.get("org_name"),
        org_type=ctx.get("org_type"),
        org_sector=ctx.get("org_sector"),
        page_title=title,
        meta_description=description,
    )

    if judgment.status == "pass":
        status = FindingStatus.pass_
    elif judgment.status == "fail":
        status = FindingStatus.fail
    else:
        status = FindingStatus.manual_review

    hostname = (urlparse(url).hostname or "").lower()
    return [
        Finding(
            category="domain_identity",
            check_name="domain_semantic_relevance",
            clause_reference="6.4.4",
            status=status,
            severity="medium",
            automatability_type="M",
            detail={
                "hostname": hostname,
                "stated_purpose": ctx.get("stated_purpose"),
                "org_name": ctx.get("org_name"),
                "org_type": ctx.get("org_type"),
                "org_sector": ctx.get("org_sector"),
                "page_title": title,
                "reason": judgment.justification,
                "ai_model_used": judgment.model_used,
                "requires_manual_review": status == FindingStatus.manual_review,
            },
        )
    ]
