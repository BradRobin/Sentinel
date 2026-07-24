from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import datetime, timezone
from typing import Any

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.redis_client import get_redis
from app.core.ssrf import normalize_url_for_lock
from app.services.historical import upsert_historical_score_for_scan
from app.services.registry import record_score_update_for_scan
from app.services.scan_cache import set_cached_scan
from app.services.scan_errors import (
    ERROR_CATEGORIES,
    ScanAbortError,
    classify_fetch_failure,
    safe_reason,
)
from app.services.scan_repository import (
    get_scan_record,
    save_findings,
    save_narrative,
    save_scores,
    update_scan_status,
)
from app.services.scan_runner import (
    CATEGORY_LABELS,
    TOTAL_SCORED_CATEGORIES,
    run_all_checks,
)
from app.services.scoring import compute_scores
from app.services.ai.narrative import generate_scan_narrative

logger = logging.getLogger(__name__)

LOCK_TTL_SECONDS = 600
JOB_KEY_PREFIX = "scan:job:"
LOCK_KEY_PREFIX = "scan:lock:"


def _job_key(job_id: str) -> str:
    return f"{JOB_KEY_PREFIX}{job_id}"


def _lock_key(url: str) -> str:
    normalized = normalize_url_for_lock(url)
    return f"{LOCK_KEY_PREFIX}{normalized}"


def get_active_scan_job_id(url: str) -> str | None:
    """Return job_id holding the idempotency lock for this URL, if any."""
    try:
        raw = get_redis().get(_lock_key(url))
    except Exception as exc:
        logger.warning("Lock lookup failed: %s", exc)
        return None
    if not raw:
        return None
    return raw.decode() if isinstance(raw, bytes) else str(raw)


def claim_scan_lock(url: str, scan_id: str) -> bool:
    """Claim the URL lock for a newly queued scan. Returns False if already held."""
    return bool(
        get_redis().set(_lock_key(url), scan_id, nx=True, ex=LOCK_TTL_SECONDS)
    )


def _lock_holder(redis_client: Any, lock_key: str) -> str | None:
    raw = redis_client.get(lock_key)
    if not raw:
        return None
    return raw.decode() if isinstance(raw, bytes) else str(raw)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def classify_scan_failure(exc: BaseException) -> tuple[str, str]:
    """
    Return (error_category, safe_reason) for failed job status.

    Never returns raw exception text to callers.
    """
    if isinstance(exc, ScanAbortError):
        cat = exc.category if exc.category in ERROR_CATEGORIES else "internal_error"
        return cat, safe_reason(cat)

    if isinstance(exc, FuturesTimeout):
        return "timeout", safe_reason("timeout")

    category = classify_fetch_failure(exc)
    if category in ("unreachable", "blocked_by_target", "timeout"):
        return category, safe_reason(category)
    return "internal_error", safe_reason("internal_error")


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
        data.setdefault("attached_to_existing", False)
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
    if record.get("narrative"):
        result["narrative"] = record["narrative"]
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
        "attached_to_existing": False,
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
        "attached_to_existing": False,
    }
    payload.update(extra)
    return payload


@celery_app.task(name="app.workers.scan_tasks.run_scan", bind=True)
def run_scan(self, scan_id: str, url: str) -> dict[str, Any]:
    """Run full check suite with category progress; persist and cache results."""
    redis_client = get_redis()
    lock_key = _lock_key(url)
    allowed_tlds = [t.strip() for t in settings.allowed_tld.split(",") if t.strip()]
    max_seconds = settings.scan_max_duration_seconds

    acquired = redis_client.set(lock_key, scan_id, nx=True, ex=LOCK_TTL_SECONDS)
    holder = _lock_holder(redis_client, lock_key)
    if not acquired and holder != scan_id:
        # Another job owns the lock (should be rare if API claimed at enqueue)
        logger.info(
            "Duplicate scan worker race for %s (existing=%s, orphan=%s)",
            url,
            holder,
            scan_id,
        )
        update_scan_status(scan_id, "failed")
        payload = _base_payload(
            scan_id,
            url,
            status="failed",
            error=safe_reason("duplicate_in_progress"),
            error_category="duplicate_in_progress",
        )
        set_job_status(scan_id, payload)
        return payload

    # Refresh TTL whether we just claimed or already owned from enqueue
    redis_client.expire(lock_key, LOCK_TTL_SECONDS)

    current_category: str | None = None
    categories_completed: list[str] = []

    def _partial_result(findings_so_far: list) -> dict[str, Any] | None:
        if not findings_so_far:
            return None
        findings_payload = [f.model_dump(mode="json") for f in findings_so_far]
        return {
            "findings": findings_payload,
            "finding_count": len(findings_payload),
            "partial": True,
        }

    def on_progress(
        category: str | None,
        completed: list[str],
        findings_so_far: list | None = None,
    ) -> None:
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
                result=_partial_result(findings_so_far or []),
            ),
        )

    try:
        update_scan_status(scan_id, "running")
        set_job_status(
            scan_id,
            _base_payload(
                scan_id,
                url,
                status="running",
                progress=None,
            ),
        )

        def _run() -> list:
            return run_all_checks(
                url,
                allowed_tlds=allowed_tlds,
                allow_tld_bypass=settings.allow_tld_bypass,
                on_progress=on_progress,
            )

        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_run)
            try:
                findings = future.result(timeout=max_seconds)
            except FuturesTimeout as exc:
                future.cancel()
                raise ScanAbortError("timeout") from exc

        # Publish full findings while scoring + narrative still run
        set_job_status(
            scan_id,
            _base_payload(
                scan_id,
                url,
                status="running",
                current_category=None,
                categories_completed=list(categories_completed),
                progress="Scoring and preparing summary…",
                result=_partial_result(findings),
            ),
        )

        save_findings(scan_id, findings)
        score_result = compute_scores(findings)
        save_scores(scan_id, score_result)
        upsert_historical_score_for_scan(scan_id, score_result)
        try:
            record_score_update_for_scan(scan_id, score_result)
        except Exception as exc:
            logger.warning(
                "Registry score update failed for scan %s: %s", scan_id, exc
            )

        # Narrative runs after the timed check suite so LLM latency cannot abort scoring.
        narrative: str | None = None
        try:
            narrative = generate_scan_narrative(url, findings, score_result)
            if narrative:
                save_narrative(scan_id, narrative)
        except Exception as exc:
            logger.warning("Narrative generation failed for scan %s: %s", scan_id, exc)

        update_scan_status(scan_id, "complete")

        findings_payload = [f.model_dump(mode="json") for f in findings]
        scores_payload = score_result.to_dict()
        result = {
            "findings": findings_payload,
            "finding_count": len(findings_payload),
            "scores": scores_payload,
            "overall_score": round(score_result.overall_score, 2),
            "narrative": narrative,
            "partial": False,
        }
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
        # Full detail server-side only
        logger.exception(
            "Scan failed for scan %s category_hint=%s",
            scan_id,
            getattr(exc, "category", None),
        )
        update_scan_status(scan_id, "failed")
        error_category, reason = classify_scan_failure(exc)
        payload = _base_payload(
            scan_id,
            url,
            status="failed",
            error=reason,
            error_category=error_category,
            current_category=current_category,
            categories_completed=list(categories_completed),
        )
        set_job_status(scan_id, payload)
        return payload
    finally:
        current = redis_client.get(lock_key)
        if current == scan_id or (
            isinstance(current, bytes) and current.decode() == scan_id
        ):
            redis_client.delete(lock_key)
