from __future__ import annotations

import json
import logging
from typing import Any

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.redis_client import get_redis
from app.core.ssrf import normalize_url_for_lock
from app.services.scan_cache import set_cached_scan
from app.services.scan_repository import (
    get_scan_record,
    save_findings,
    save_scores,
    update_scan_status,
)
from app.services.scan_runner import run_all_checks
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
    }


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
        payload = {
            "job_id": scan_id,
            "status": "failed",
            "url": url,
            "result": None,
            "error": "A scan for this URL is already in progress",
            "cache_hit": False,
            "progress": None,
        }
        set_job_status(scan_id, payload)
        return payload

    def on_progress(message: str) -> None:
        set_job_status(
            scan_id,
            {
                "job_id": scan_id,
                "status": "running",
                "url": url,
                "result": None,
                "error": None,
                "cache_hit": False,
                "progress": message,
            },
        )

    try:
        update_scan_status(scan_id, "running")
        on_progress("Starting scan…")

        findings = run_all_checks(
            url,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=settings.allow_tld_bypass,
            on_progress=on_progress,
        )
        save_findings(scan_id, findings)
        score_result = compute_scores(findings)
        save_scores(scan_id, score_result)
        update_scan_status(scan_id, "complete")

        findings_payload = [f.model_dump(mode="json") for f in findings]
        scores_payload = score_result.to_dict()
        result = {
            "findings": findings_payload,
            "finding_count": len(findings_payload),
            "scores": scores_payload,
            "overall_score": round(score_result.overall_score, 2),
        }
        payload = {
            "job_id": scan_id,
            "status": "complete",
            "url": url,
            "result": result,
            "error": None,
            "cache_hit": False,
            "progress": None,
        }
        set_job_status(scan_id, payload)
        set_cached_scan(url, payload)
        return payload
    except Exception as exc:
        logger.exception("Scan failed for scan %s", scan_id)
        update_scan_status(scan_id, "failed")
        payload = {
            "job_id": scan_id,
            "status": "failed",
            "url": url,
            "result": None,
            "error": str(exc),
            "cache_hit": False,
            "progress": None,
        }
        set_job_status(scan_id, payload)
        return payload
    finally:
        current = redis_client.get(lock_key)
        if current == scan_id:
            redis_client.delete(lock_key)
