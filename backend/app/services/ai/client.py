"""Thin Anthropic Messages API client. Isolated from the rule engine."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_TIMEOUT_SECONDS = 20.0

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def is_ai_configured() -> bool:
    return bool(settings.anthropic_api_key and settings.anthropic_api_key.strip())


def complete_text(
    *,
    system: str,
    user: str,
    max_tokens: int = 400,
    model: str | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> str | None:
    """
    Call Claude and return assistant text, or None on missing key / API failure.

    Never raises — callers degrade to manual_review / omit narrative.
    """
    if not is_ai_configured():
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed; skipping AI call")
        return None

    try:
        client = anthropic.Anthropic(
            api_key=settings.anthropic_api_key.strip(),
            timeout=timeout,
        )
        message = client.messages.create(
            model=model or DEFAULT_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except Exception as exc:
        logger.warning("Anthropic API call failed: %s", exc)
        return None

    parts: list[str] = []
    for block in getattr(message, "content", []) or []:
        text = getattr(block, "text", None)
        if isinstance(text, str) and text.strip():
            parts.append(text.strip())
    return "\n".join(parts).strip() or None


def parse_json_object(text: str) -> dict[str, Any] | None:
    """Extract a JSON object from model output (raw or fenced)."""
    raw = text.strip()
    fence = _JSON_FENCE_RE.search(raw)
    if fence:
        raw = fence.group(1).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None
