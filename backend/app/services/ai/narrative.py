"""Plain-language scan narrative from structured findings — not a re-check of rules."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.schemas.findings import Finding, FindingStatus
from app.services.ai.client import complete_text
from app.services.scoring import ScoreResult

logger = logging.getLogger(__name__)

# Split after .!? only when followed by whitespace — keeps 67.9% and ICTA.6.002 intact.
_SENTENCE_END_RE = re.compile(r"(?<=[.!?])\s+")

_SYSTEM = """You are an ICT Authority (Kenya) compliance officer summarizing a website scan
against ICTA.6.002:2019 Section 6.4. Write 2–3 short sentences of plain English for a
government web officer. Focus on the most important failures and review items. Do not
invent checks that are not in the data. Do not use bullet lists or markdown headings.
Do not mention that you are an AI. Prefer the site hostname over full URLs."""


def _status_value(status: FindingStatus | str) -> str:
    if isinstance(status, FindingStatus):
        return status.value
    return str(status)


def _top_issues(findings: list[Finding], limit: int = 5) -> list[dict[str, Any]]:
    ranked = sorted(
        findings,
        key=lambda f: (
            0 if _status_value(f.status) == "fail" else 1 if _status_value(f.status) == "manual_review" else 2,
            {"high": 0, "medium": 1, "low": 2}.get(f.severity, 9),
            f.check_name,
        ),
    )
    out: list[dict[str, Any]] = []
    for f in ranked:
        if _status_value(f.status) == "pass":
            continue
        detail = f.detail or {}
        reason = (
            detail.get("reason")
            or detail.get("summary")
            or detail.get("message")
            or detail.get("note")
            or ""
        )
        out.append(
            {
                "check": f.check_name,
                "category": f.category,
                "status": _status_value(f.status),
                "severity": f.severity,
                "clause": f.clause_reference,
                "detail": str(reason)[:200] if reason else None,
            }
        )
        if len(out) >= limit:
            break
    return out


def _counts(findings: list[Finding]) -> dict[str, int]:
    counts = {"pass": 0, "fail": 0, "manual_review": 0}
    for f in findings:
        key = _status_value(f.status)
        if key in counts:
            counts[key] += 1
    return counts


def _trim_narrative(text: str, max_sentences: int = 3) -> str:
    """Normalize whitespace and keep at most max_sentences without splitting decimals."""
    cleaned = " ".join(line.strip() for line in text.splitlines() if line.strip())
    if cleaned.startswith("- "):
        cleaned = cleaned.lstrip("- ").strip()
    parts = [p.strip() for p in _SENTENCE_END_RE.split(cleaned) if p.strip()]
    if len(parts) > max_sentences:
        return " ".join(parts[:max_sentences])
    return cleaned


def generate_scan_narrative(
    url: str,
    findings: list[Finding],
    score_result: ScoreResult | None = None,
) -> str | None:
    """
    Return a 2–3 sentence summary, or None if AI is unavailable / fails.

    Inputs are structured findings and scores only — never re-runs checks.
    """
    counts = _counts(findings)
    overall = round(score_result.overall_score, 1) if score_result else None
    category_scores = []
    if score_result:
        category_scores = [
            {"category": c.category, "score": round(c.score, 1)}
            for c in score_result.categories
            if c.fail_count > 0 or c.manual_review_count > 0
        ][:6]

    user = (
        f"Scanned URL: {url}\n"
        f"Overall compliance score: {overall if overall is not None else 'n/a'}%\n"
        f"Counts: {counts['fail']} failures, {counts['manual_review']} needing review, "
        f"{counts['pass']} passes (of {len(findings)} checks).\n"
        f"Weak categories: {category_scores or 'none flagged'}\n"
        f"Top issues (structured): {_top_issues(findings)}\n\n"
        "Write the 2–3 sentence officer-facing summary now."
    )

    text = complete_text(system=_SYSTEM, user=user, max_tokens=400)
    if not text:
        return None

    cleaned = _trim_narrative(text)
    return cleaned or None
