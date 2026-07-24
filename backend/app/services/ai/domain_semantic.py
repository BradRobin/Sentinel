"""LLM judgment for domain ↔ stated-purpose semantic relevance (clause 6.4.4)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlparse

from app.services.ai.client import complete_text, parse_json_object

logger = logging.getLogger(__name__)

JudgmentStatus = Literal["pass", "fail", "flag"]

_SYSTEM = """You assess whether a Kenyan government website domain name bears a semantic
connection to the MCDA's (Ministry, County, Department, or Agency) stated purpose,
per ICTA.6.002:2019 clause 6.4.4.

Respond with ONLY a JSON object (no markdown) of this shape:
{"status":"pass"|"fail"|"flag","justification":"<one or two short sentences>"}

Rules:
- "pass": domain clearly relates to the stated purpose / org identity.
- "fail": domain is clearly unrelated or misleading relative to the purpose.
- "flag": evidence is incomplete or ambiguous — a human officer should decide.
- If stated_purpose is unknown, prefer "flag" unless the domain and page title/meta
  clearly identify a coherent government entity purpose that matches the hostname.
- Be concise. Do not invent organizational facts not present in the input."""


@dataclass(frozen=True)
class DomainSemanticJudgment:
    status: JudgmentStatus
    justification: str
    model_used: bool


def _hostname(url: str) -> str:
    return (urlparse(url).hostname or "").lower().rstrip(".")


def judge_domain_semantic_relevance(
    *,
    url: str,
    stated_purpose: str | None = None,
    org_name: str | None = None,
    org_type: str | None = None,
    org_sector: str | None = None,
    page_title: str | None = None,
    meta_description: str | None = None,
) -> DomainSemanticJudgment:
    """
    Ask Claude to judge domain ↔ purpose relevance.

    On missing API key or parse failure, returns status=\"flag\" so the finding
    stays reviewable rather than inventing a deterministic fail.
    """
    host = _hostname(url)
    purpose = (stated_purpose or "").strip() or None

    user = (
        f"hostname: {host}\n"
        f"url: {url}\n"
        f"stated_purpose: {purpose or '(unknown)'}\n"
        f"org_name: {(org_name or '').strip() or '(unknown)'}\n"
        f"org_type: {(org_type or '').strip() or '(unknown)'}\n"
        f"org_sector: {(org_sector or '').strip() or '(unknown)'}\n"
        f"page_title: {(page_title or '').strip() or '(none)'}\n"
        f"meta_description: {(meta_description or '').strip() or '(none)'}\n"
    )

    text = complete_text(system=_SYSTEM, user=user, max_tokens=220)
    if not text:
        return DomainSemanticJudgment(
            status="flag",
            justification=(
                "AI judgment unavailable — requires human review of whether the "
                "domain bears a semantic connection to the stated purpose"
            ),
            model_used=False,
        )

    data = parse_json_object(text)
    if not data:
        logger.warning("Could not parse domain semantic JSON: %s", text[:200])
        return DomainSemanticJudgment(
            status="flag",
            justification="AI response was inconclusive — flagging for officer review",
            model_used=True,
        )

    raw_status = str(data.get("status", "flag")).strip().lower()
    if raw_status not in ("pass", "fail", "flag"):
        raw_status = "flag"
    justification = str(data.get("justification") or data.get("reason") or "").strip()
    if not justification:
        justification = "No justification returned — flagging for officer review"
        raw_status = "flag"

    return DomainSemanticJudgment(
        status=raw_status,  # type: ignore[arg-type]
        justification=justification[:500],
        model_used=True,
    )
