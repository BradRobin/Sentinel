from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.redis_client import get_redis
from app.core.ssrf import normalize_url_for_lock

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
    redis_client.setex(_job_key(job_id), settings.scan_cache_ttl_seconds, json.dumps(payload))


def get_job_status(job_id: str) -> dict[str, Any] | None:
    redis_client = get_redis()
    raw = redis_client.get(_job_key(job_id))
    if not raw:
        return None
    return json.loads(raw)


@celery_app.task(name="app.workers.scan_tasks.run_scan", bind=True)
def run_scan(self, job_id: str, url: str) -> dict[str, Any]:
    """
    Phase 1 stub scan task.

    Acquires idempotency lock, simulates work, stores result in Redis.
    Full rule engine wired in Phases 2-3.
    """
    redis_client = get_redis()
    lock_key = _lock_key(url)

    acquired = redis_client.set(lock_key, job_id, nx=True, ex=LOCK_TTL_SECONDS)
    if not acquired:
        existing_job_id = redis_client.get(lock_key)
        logger.info("Scan already in progress for %s (job %s)", url, existing_job_id)
        set_job_status(
            job_id,
            {
                "job_id": job_id,
                "status": "failed",
                "url": url,
                "error": "A scan for this URL is already in progress",
            },
        )
        return {"status": "failed", "error": "duplicate_scan"}

    try:
        set_job_status(
            job_id,
            {"job_id": job_id, "status": "running", "url": url, "result": None, "error": None},
        )

        # Phase 1 stub: simulate scan categories
        time.sleep(2)

        result = {
            "overall_score": None,
            "message": "Stub scan complete — rule engine not yet wired (Phase 2)",
            "findings": [],
        }
        payload = {
            "job_id": job_id,
            "status": "complete",
            "url": url,
            "result": result,
            "error": None,
        }
        set_job_status(job_id, payload)
        return payload
    except Exception as exc:
        logger.exception("Scan failed for job %s", job_id)
        payload = {
            "job_id": job_id,
            "status": "failed",
            "url": url,
            "result": None,
            "error": str(exc),
        }
        set_job_status(job_id, payload)
        return payload
    finally:
        current = redis_client.get(lock_key)
        if current == job_id:
            redis_client.delete(lock_key)
