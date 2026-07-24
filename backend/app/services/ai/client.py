"""Thin Gemini API client. Isolated from the rule engine."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-3.5-flash-lite"
DEFAULT_TIMEOUT_SECONDS = 20.0

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def is_ai_configured() -> bool:
    return bool(settings.gemini_api_key and settings.gemini_api_key.strip())


def complete_text(
    *,
    system: str,
    user: str,
    max_tokens: int = 400,
    model: str | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> str | None:
    """
    Call Gemini and return assistant text, or None on missing key / API failure.

    Never raises — callers degrade to manual_review / omit narrative.
    """
    if not is_ai_configured():
        return None

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.warning("google-genai package not installed; skipping AI call")
        return None

    try:
        client = genai.Client(
            api_key=settings.gemini_api_key.strip(),
            http_options=types.HttpOptions(timeout=int(timeout * 1000)),
        )
        response = client.models.generate_content(
            model=model or DEFAULT_MODEL,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.2,
            ),
        )
    except Exception as exc:
        logger.warning("Gemini API call failed: %s", exc)
        return None

    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()
    return None


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
