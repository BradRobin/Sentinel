"""Weekly MCDA registry rescan — enqueue scheduled scans for verified domains."""

from __future__ import annotations

import logging

from app.core.celery_app import celery_app
from app.core.config import settings
from app.services.registry import list_verified_domains_for_scan
from app.services.scan_cache import invalidate_cached_scan
from app.services.scan_repository import create_scan_record
from app.workers.scan_tasks import (
    claim_scan_lock,
    get_active_scan_job_id,
    run_scan,
    set_job_status,
)

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.registry_tasks.enqueue_registry_scans")
def enqueue_registry_scans() -> dict:
    """
    Enqueue a scheduled scan for every verified registry domain.

    Skips URLs that already have an in-flight scan. Invalidates cache so the
    weekly pass always measures current compliance rather than serving 24h hits.
    """
    domains = list_verified_domains_for_scan()
    queued = 0
    attached = 0
    skipped = 0

    for item in domains:
        url = item["url"]
        domain_id = item["domain_id"]

        existing_id = get_active_scan_job_id(url)
        if existing_id:
            attached += 1
            logger.info(
                "Registry weekly: attach existing job %s for %s",
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
            triggered_type="scheduled",
            domain_id=domain_id,
        )
        if not claim_scan_lock(url, scan_id):
            skipped += 1
            logger.info("Registry weekly: lost lock race for %s", url)
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
        run_scan.delay(scan_id, url)
        queued += 1
        logger.info("Registry weekly: queued scan %s for %s", scan_id, url)

    summary = {
        "domain_count": len(domains),
        "queued": queued,
        "attached_in_flight": attached,
        "skipped_lock": skipped,
        "concurrency": settings.celery_worker_concurrency,
    }
    logger.info("Registry weekly enqueue complete: %s", summary)
    return summary
