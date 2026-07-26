"""MCDA registry API — dashboard list, autocomplete, bulk scan."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response

from app.schemas.registry import (
    RegistryEntry,
    RegistryListResponse,
    RegistryScanBatchStatusResponse,
    RegistryScanEnqueueResponse,
    RegistryScanJob,
    RegistrySuggestion,
    RegistrySuggestionsResponse,
)
from app.core.config import settings
from app.services.registry import (
    list_registry_entries,
    list_verified_domains_for_scan,
    match_registry_suggestions,
)
from app.services.registry_scan import (
    enqueue_registry_scans,
    get_active_registry_batch_id,
    get_registry_scan_batch,
)

router = APIRouter(prefix="/registry", tags=["registry"])


@router.get("", response_model=RegistryListResponse)
def get_registry(
    org_type: str | None = Query(
        default=None,
        description="Filter by organization type: ministry, county, agency",
    ),
    q: str | None = Query(default=None, description="Search name, alias, or URL"),
    limit: int = Query(default=200, ge=1, le=500),
) -> RegistryListResponse:
    items = list_registry_entries(org_type=org_type, q=q, limit=limit)
    return RegistryListResponse(
        count=len(items),
        items=[RegistryEntry(**row) for row in items],
    )


@router.get("/suggestions", response_model=RegistrySuggestionsResponse)
def get_registry_suggestions(
    q: str = Query(..., min_length=1, description="Partial name or alias"),
    limit: int = Query(default=5, ge=1, le=20),
) -> RegistrySuggestionsResponse:
    rows = match_registry_suggestions(q, limit=limit)
    return RegistrySuggestionsResponse(
        items=[RegistrySuggestion(**row) for row in rows],
    )


@router.post("/scan", response_model=RegistryScanEnqueueResponse)
def start_registry_scan(response: Response) -> RegistryScanEnqueueResponse:
    """
    Enqueue fresh scans for every verified MCDA registry domain.

    Scores are written to ``domain_score_updates`` when each scan completes
    (same path as the weekly Celery beat job). If a batch is already in flight,
    returns that batch so the UI can resume polling.
    """
    active_id = get_active_registry_batch_id()
    if active_id:
        existing = get_registry_scan_batch(active_id)
        if existing and not existing.get("done"):
            response.status_code = 202
            jobs = [
                RegistryScanJob(
                    job_id=j["job_id"],
                    url=j.get("url") or "",
                    domain_id=j.get("domain_id") or "",
                    action="attached"
                    if j.get("action") == "attached"
                    else "queued",
                )
                for j in existing.get("jobs") or []
                if j.get("job_id")
            ]
            counts = existing.get("counts") or {}
            return RegistryScanEnqueueResponse(
                batch_id=active_id,
                domain_count=int(existing.get("domain_count") or len(jobs)),
                queued=int(counts.get("queued") or 0),
                attached_in_flight=int(counts.get("running") or 0),
                skipped_lock=0,
                concurrency=settings.celery_worker_concurrency,
                triggered_type=existing.get("triggered_type") or "manual",
                jobs=jobs,
                resumed=True,
            )

    if not list_verified_domains_for_scan():
        raise HTTPException(
            status_code=400,
            detail=(
                "No verified MCDA domains in the database. "
                "Run docker compose (db-init) or scripts/seed_mcda_registry.py first."
            ),
        )

    summary = enqueue_registry_scans(triggered_type="manual")

    response.status_code = 202
    return RegistryScanEnqueueResponse(
        batch_id=summary["batch_id"],
        domain_count=summary["domain_count"],
        queued=summary["queued"],
        attached_in_flight=summary["attached_in_flight"],
        skipped_lock=summary["skipped_lock"],
        concurrency=summary["concurrency"],
        triggered_type=summary["triggered_type"],
        jobs=[RegistryScanJob(**j) for j in summary["jobs"]],
        resumed=False,
    )


@router.get("/scan/{batch_id}", response_model=RegistryScanBatchStatusResponse)
def get_registry_scan_status(batch_id: str) -> RegistryScanBatchStatusResponse:
    payload = get_registry_scan_batch(batch_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Registry scan batch not found")
    return RegistryScanBatchStatusResponse(**payload)
