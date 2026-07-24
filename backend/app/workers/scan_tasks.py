from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.redis_client import get_redis
from app.core.ssrf import SSRFError, normalize_url_for_lock
from app.services.historical import upsert_historical_score_for_scan
from app.services.scan_cache import set_cached_scan
from app.services.scan_repository import (
    get_scan_record,
    save_findings,
    save_scores,
    update_scan_status,
)
from app.services.scan_runner import (
    CATEGORY_LABELS,
    TOTAL_SCORED_CATEGORIES,
    run_all_checks,
)
from app.services.scoring import compute_scores

logger = logging.getLogger(__name__)

LOCK_TTL_SECONDS = 600
JOB_KEY_PREFIX = "scan:job:"
LOCK_KEY_PREFIX = "scan:lock:"


def _job_key(job_id: str) -> str:
    return f"{JOB_KEY_PREFIX}{job_id}"


def _lock_key(url: str) -> str:
    normalized = normalize_url_for_lock(url)
    return f"{LOCK_KEY_PREFIX}{normalized}"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def classify_scan_failure(
    exc: BaseException,
    *,
    current_category: str | None = None,
) -> tuple[str | None, str]:
    """Return (error_category, short_reason) for failed job status."""
    msg = str(exc)
    lower = msg.lower()
    exc_name = type(exc).__name__.lower()
    if (
        isinstance(exc, TimeoutError)
        or "timed out" in lower
        or "timeout" in lower
        or "timeout" in exc_name
    ):
        return current_category or "timeout", "timeout"
    if isinstance(exc, SSRFError):
        if "unable to resolve" in lower or "no dns" in lower:
            return current_category or "unreachable", "unreachable"
        return current_category or "invalid_url", "invalid_url"
    if (
        "unable to resolve" in lower
        or "name or service" in lower
        or "connection" in lower
        or "unreachable" in lower
        or "connecterror" in lower
        or "connect error" in lower
    ):
        return current_category or "unreachable", "unreachable"
    return current_category, msg[:240]


def set_job_status(job_id: str, payload: dict[str, Any]) -> None:
    redis_client = get_redis()
    redis_client.setex(
        _job_key(job_id),
        settings.scan_cache_ttl_seconds,
        json.dumps(payload, default=str),
    )


def get_job_status(job_id: str) -> dict[str, Any] | None:
    redis_client = get_redis()
    raw = redis_client.get(_job_key(job_id))
    if raw:
        data = json.loads(raw)
        data.setdefault("cache_hit", False)
        data.setdefault("progress", None)
        data.setdefault("current_category", None)
        data.setdefault("categories_completed", [])
        data.setdefault("total_categories", TOTAL_SCORED_CATEGORIES)
        data.setdefault("updated_at", None)
        data.setdefault("error_category", None)
        return data
    record = get_scan_record(job_id)
    if not record:
        return None
    result: dict[str, Any] = {}
    if record["findings"]:
        result["findings"] = record["findings"]
        result["finding_count"] = len(record["findings"])
    if record.get("scores"):
        result["scores"] = record["scores"]
        result["overall_score"] = record["scores"].get("overall_score")
    return {
        "job_id": record["scan_id"],
        "status": record["status"],
        "url": record["url"],
        "result": result or None,
        "error": None,
        "cache_hit": False,
        "progress": None,
        "current_category": None,
        "categories_completed": [],
        "total_categories": TOTAL_SCORED_CATEGORIES,
        "updated_at": None,
        "error_category": None,
    }


def _base_payload(
    scan_id: str,
    url: str,
    *,
    status: str,
    **extra: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "job_id": scan_id,
        "status": status,
        "url": url,
        "result": None,
        "error": None,
        "cache_hit": False,
        "progress": None,
        "current_category": None,
        "categories_completed": [],
        "total_categories": TOTAL_SCORED_CATEGORIES,
        "updated_at": _utc_now_iso(),
        "error_category": None,
    }
    payload.update(extra)
    return payload


@celery_app.task(name="app.workers.scan_tasks.run_scan", bind=True)
def run_scan(self, scan_id: str, url: str) -> dict[str, Any]:
    """Run full check suite with category progress; persist and cache results."""
    redis_client = get_redis()
    lock_key = _lock_key(url)
    allowed_tlds = [t.strip() for t in settings.allowed_tld.split(",") if t.strip()]

    acquired = redis_client.set(lock_key, scan_id, nx=True, ex=LOCK_TTL_SECONDS)
    if not acquired:
        existing = redis_client.get(lock_key)
        logger.info("Scan already in progress for %s (scan %s)", url, existing)
        update_scan_status(scan_id, "failed")
        payload = _base_payload(
            scan_id,
            url,
            status="failed",
            error="A scan for this URL is already in progress",
            error_category="conflict",
        )
        set_job_status(scan_id, payload)
        return payload

    current_category: str | None = None
    categories_completed: list[str] = []

    def on_progress(category: str | None, completed: list[str]) -> None:
        nonlocal current_category, categories_completed
        current_category = category
        categories_completed = list(completed)
        label = CATEGORY_LABELS.get(category or "", None)
        set_job_status(
            scan_id,
            _base_payload(
                scan_id,
                url,
                status="running",
                current_category=category,
                categories_completed=categories_completed,
                progress=label,
            ),
        )

    try:
        update_scan_status(scan_id, "running")
        # Worker picked up; still no category until first scored check starts
        set_job_status(
            scan_id,
            _base_payload(
                scan_id,
                url,
                status="running",
                progress=None,
            ),
        )

        findings = run_all_checks(
            url,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=settings.allow_tld_bypass,
            on_progress=on_progress,
        )
        save_findings(scan_id, findings)
        score_result = compute_scores(findings)
        save_scores(scan_id, score_result)
        upsert_historical_score_for_scan(scan_id, score_result)
        update_scan_status(scan_id, "complete")

        findings_payload = [f.model_dump(mode="json") for f in findings]
        scores_payload = score_result.to_dict()
        result = {
            "findings": findings_payload,
            "finding_count": len(findings_payload),
            "scores": scores_payload,
            "overall_score": round(score_result.overall_score, 2),
        }
        # Persist first, then mark complete — never flip UI before DB write
        payload = _base_payload(
            scan_id,
            url,
            status="complete",
            result=result,
            current_category=None,
            categories_completed=list(categories_completed),
            progress=None,
        )
        set_job_status(scan_id, payload)
        set_cached_scan(url, payload)
        return payload
    except Exception as exc:
        logger.exception("Scan failed for scan %s", scan_id)
        update_scan_status(scan_id, "failed")
        error_category, reason = classify_scan_failure(
            exc, current_category=current_category
        )
        payload = _base_payload(
            scan_id,
            url,
            status="failed",
            error=reason if reason in ("timeout", "unreachable", "invalid_url") else str(exc),
            error_category=error_category,
            current_category=current_category,
            categories_completed=list(categories_completed),
        )
        set_job_status(scan_id, payload)
        return payload
    finally:
        current = redis_client.get(lock_key)
        if current == scan_id:
            redis_client.delete(lock_key)
