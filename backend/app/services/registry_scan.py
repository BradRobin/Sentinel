"""Enqueue compliance scans for verified MCDA registry domains."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Literal

from app.core.config import settings
from app.core.redis_client import get_redis
from app.core.ssrf import SSRFError
from app.services.registry import list_verified_domains_for_scan
from app.services.scan_cache import invalidate_cached_scan
from app.services.scan_repository import create_scan_record
from app.services.manual_review import requeue_due_manual_review_items
from app.workers.scan_tasks import (
    claim_scan_lock,
    get_active_scan_job_id,
    get_job_status,
    run_scan,
    set_job_status,
)

logger = logging.getLogger(__name__)

BATCH_KEY_PREFIX = "registry:scan:batch:"
ACTIVE_BATCH_KEY = "registry:scan:active"
BATCH_TTL_SECONDS = 60 * 60 * 24  # 24h


TriggeredType = Literal["manual", "scheduled"]


def _batch_key(batch_id: str) -> str:
    return f"{BATCH_KEY_PREFIX}{batch_id}"


def enqueue_registry_scans(
    *,
    triggered_type: TriggeredType = "scheduled",
) -> dict[str, Any]:
    """
    Enqueue a scan for every verified registry domain.

    Skips URLs that already have an in-flight scan. Invalidates cache so the
    pass measures current compliance rather than serving 24h hits.

    Per-domain failures (DNS/SSRF/lock errors) are skipped so one bad host
    cannot abort the whole registry batch.

    Returns a batch summary including ``batch_id`` and per-job metadata for
    progress polling from the registry dashboard.
    """
    if triggered_type not in ("manual", "scheduled"):
        triggered_type = "manual"

    # Officer manual review cadence: flip any stale resolutions back to pending
    # so the queue doesn't silently stop updating after a quarter.
    try:
        requeued = requeue_due_manual_review_items()
        logger.info("Manual review cadence requeue: %s items", requeued)
    except Exception as exc:
        logger.warning("Manual review cadence requeue failed: %s", exc)

    domains = list_verified_domains_for_scan()
    queued = 0
    attached = 0
    skipped = 0
    jobs: list[dict[str, str]] = []

    for item in domains:
        url = item["url"]
        domain_id = item["domain_id"]
        try:
            existing_id = get_active_scan_job_id(url)
            if existing_id:
                attached += 1
                jobs.append(
                    {
                        "job_id": existing_id,
                        "url": url,
                        "domain_id": domain_id,
                        "action": "attached",
                    }
                )
                logger.info(
                    "Registry scan: attach existing job %s for %s",
                    existing_id,
                    url,
                )
                continue

            try:
                invalidate_cached_scan(url)
            except Exception as exc:
                logger.warning("Cache invalidate failed for %s: %s", url, exc)

            scan_id = create_scan_record(
                url,
                triggered_type=triggered_type,
                domain_id=domain_id,
            )
            if not claim_scan_lock(url, scan_id):
                skipped += 1
                existing_id = get_active_scan_job_id(url)
                if existing_id:
                    jobs.append(
                        {
                            "job_id": existing_id,
                            "url": url,
                            "domain_id": domain_id,
                            "action": "attached",
                        }
                    )
                logger.info("Registry scan: lost lock race for %s", url)
                continue

            set_job_status(
                scan_id,
                {
                    "job_id": scan_id,
                    "status": "queued",
                    "url": url,
                    "result": None,
                    "error": None,
                    "cache_hit": False,
                    "progress": "Queued…",
                    "current_category": None,
                    "categories_completed": [],
                    "total_categories": 8,
                    "updated_at": None,
                    "error_category": None,
                    "attached_to_existing": False,
                },
            )
            run_scan.delay(scan_id, url, skip_narrative=True)
            queued += 1
            jobs.append(
                {
                    "job_id": scan_id,
                    "url": url,
                    "domain_id": domain_id,
                    "action": "queued",
                }
            )
            logger.info("Registry scan: queued scan %s for %s", scan_id, url)
        except SSRFError as exc:
            skipped += 1
            logger.warning("Registry scan: skip %s (SSRF/DNS): %s", url, exc)
        except Exception as exc:
            skipped += 1
            logger.exception("Registry scan: skip %s due to error: %s", url, exc)

    batch_id = str(uuid.uuid4())
    summary: dict[str, Any] = {
        "batch_id": batch_id,
        "domain_count": len(domains),
        "queued": queued,
        "attached_in_flight": attached,
        "skipped_lock": skipped,
        "concurrency": settings.celery_worker_concurrency,
        "triggered_type": triggered_type,
        "jobs": jobs,
    }

    redis = get_redis()
    redis.setex(
        _batch_key(batch_id),
        BATCH_TTL_SECONDS,
        json.dumps(
            {
                "batch_id": batch_id,
                "triggered_type": triggered_type,
                "jobs": jobs,
            },
            default=str,
        ),
    )
    # Only mark active when there is work to poll; empty batches must not block
    # later "Scan all" clicks.
    if jobs:
        redis.setex(ACTIVE_BATCH_KEY, BATCH_TTL_SECONDS, batch_id)

    logger.info(
        "Registry enqueue complete: %s",
        {
            k: summary[k]
            for k in (
                "batch_id",
                "domain_count",
                "queued",
                "attached_in_flight",
                "skipped_lock",
                "concurrency",
                "triggered_type",
            )
        },
    )
    return summary


def get_active_registry_batch_id() -> str | None:
    try:
        raw = get_redis().get(ACTIVE_BATCH_KEY)
    except Exception as exc:
        logger.warning("Active registry batch lookup failed: %s", exc)
        return None
    if not raw:
        return None
    return raw.decode() if isinstance(raw, bytes) else str(raw)


def get_registry_scan_batch(batch_id: str) -> dict[str, Any] | None:
    """Aggregate live job statuses for a registry scan batch."""
    redis = get_redis()
    raw = redis.get(_batch_key(batch_id))
    if not raw:
        return None
    payload = json.loads(raw)
    jobs_meta: list[dict[str, str]] = payload.get("jobs") or []

    counts = {
        "queued": 0,
        "running": 0,
        "complete": 0,
        "failed": 0,
        "unknown": 0,
    }
    jobs_out: list[dict[str, Any]] = []

    for meta in jobs_meta:
        job_id = meta["job_id"]
        status_payload = get_job_status(job_id)
        status = (
            status_payload.get("status")
            if status_payload
            else "unknown"
        )
        if status not in counts:
            status = "unknown"
        counts[status] += 1
        jobs_out.append(
            {
                "job_id": job_id,
                "url": meta.get("url"),
                "domain_id": meta.get("domain_id"),
                "action": meta.get("action"),
                "status": status,
                "progress": (
                    status_payload.get("progress") if status_payload else None
                ),
                "error": (
                    status_payload.get("error") if status_payload else None
                ),
            }
        )

    total = len(jobs_meta)
    finished = counts["complete"] + counts["failed"]
    done = finished >= total

    # Clear active pointer once the batch finishes so a new run can start.
    if done:
        active = get_active_registry_batch_id()
        if active == batch_id:
            try:
                redis.delete(ACTIVE_BATCH_KEY)
            except Exception as exc:
                logger.warning("Failed clearing active registry batch: %s", exc)

    return {
        "batch_id": batch_id,
        "triggered_type": payload.get("triggered_type"),
        "domain_count": total,
        "done": done,
        "counts": counts,
        "jobs": jobs_out,
    }
