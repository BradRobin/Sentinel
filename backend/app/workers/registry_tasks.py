"""Weekly MCDA registry rescan — enqueue scheduled scans for verified domains."""

from __future__ import annotations

import logging

from app.core.celery_app import celery_app
from app.services.registry_scan import enqueue_registry_scans

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.registry_tasks.enqueue_registry_scans")
def enqueue_registry_scans_task() -> dict:
    """Celery entrypoint for the weekly Monday registry rescan."""
    summary = enqueue_registry_scans(triggered_type="scheduled")
    # Celery result payload stays compact (omit per-job list).
    return {
        "batch_id": summary["batch_id"],
        "domain_count": summary["domain_count"],
        "queued": summary["queued"],
        "attached_in_flight": summary["attached_in_flight"],
        "skipped_lock": summary["skipped_lock"],
        "concurrency": summary["concurrency"],
    }
