from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.core.config import settings
from app.core.ssrf import SSRFError, validate_scan_url
from app.schemas.findings import (
    ComparisonResponse,
    ScanCreateRequest,
    ScanJobResponse,
    ScanStatusResponse,
)
from app.services.historical import get_comparison_for_scan
from app.services.scan_cache import get_cached_scan, invalidate_cached_scan
from app.services.scan_errors import classify_ssrf_error, safe_reason
from app.services.scan_repository import create_scan_record
from app.workers.scan_tasks import (
    claim_scan_lock,
    get_active_scan_job_id,
    get_job_status,
    run_scan,
    set_job_status,
)

router = APIRouter(prefix="/scans", tags=["scans"])


def _validation_http_error(exc: SSRFError) -> HTTPException:
    category = classify_ssrf_error(str(exc))
    return HTTPException(
        status_code=400,
        detail={
            "error_category": category,
            "message": safe_reason(category),
        },
    )


@router.post("", response_model=ScanJobResponse)
def create_scan(body: ScanCreateRequest, response: Response) -> ScanJobResponse:
    allowed_tlds = [t.strip() for t in settings.allowed_tld.split(",") if t.strip()]
    try:
        validated = validate_scan_url(
            body.url,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=settings.allow_tld_bypass,
        )
    except SSRFError as exc:
        raise _validation_http_error(exc) from exc

    if body.force:
        invalidate_cached_scan(validated.original)
    else:
        cached = get_cached_scan(validated.original)
        if cached and cached.get("status") == "complete":
            response.status_code = 200
            set_job_status(
                cached["job_id"],
                {
                    **cached,
                    "cache_hit": True,
                    "progress": None,
                    "current_category": None,
                    "categories_completed": cached.get("categories_completed") or [],
                    "total_categories": cached.get("total_categories") or 8,
                    "error_category": None,
                    "attached_to_existing": False,
                },
            )
            return ScanJobResponse(
                job_id=cached["job_id"],
                status="complete",
                url=cached.get("url") or validated.original,
                cache_hit=True,
                progress=None,
                current_category=None,
                categories_completed=[],
                total_categories=cached.get("total_categories") or 8,
                attached_to_existing=False,
            )

    # Attach to in-flight scan instead of creating a duplicate job
    existing_id = get_active_scan_job_id(validated.original)
    if existing_id:
        existing = get_job_status(existing_id)
        if existing and existing.get("status") in ("queued", "running"):
            response.status_code = 202
            return ScanJobResponse(
                job_id=existing_id,
                status=existing["status"],
                url=existing.get("url") or validated.original,
                cache_hit=False,
                progress=existing.get("progress"),
                current_category=existing.get("current_category"),
                categories_completed=existing.get("categories_completed") or [],
                total_categories=existing.get("total_categories") or 8,
                attached_to_existing=True,
            )

    scan_id = create_scan_record(validated.original)
    if not claim_scan_lock(validated.original, scan_id):
        # Lost race — attach to the winner and abandon this orphan record
        existing_id = get_active_scan_job_id(validated.original)
        if existing_id:
            existing = get_job_status(existing_id)
            if existing:
                response.status_code = 202
                return ScanJobResponse(
                    job_id=existing_id,
                    status=existing.get("status") or "running",
                    url=existing.get("url") or validated.original,
                    cache_hit=False,
                    progress=existing.get("progress"),
                    current_category=existing.get("current_category"),
                    categories_completed=existing.get("categories_completed") or [],
                    total_categories=existing.get("total_categories") or 8,
                    attached_to_existing=True,
                )

    set_job_status(
        scan_id,
        {
            "job_id": scan_id,
            "status": "queued",
            "url": validated.original,
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
    run_scan.delay(scan_id, validated.original)

    response.status_code = 202
    return ScanJobResponse(
        job_id=scan_id,
        status="queued",
        url=validated.original,
        cache_hit=False,
        progress="Queued…",
        current_category=None,
        categories_completed=[],
        total_categories=8,
        attached_to_existing=False,
    )


@router.get("/{job_id}", response_model=ScanStatusResponse)
def get_scan(job_id: str) -> ScanStatusResponse:
    payload = get_job_status(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return ScanStatusResponse(**payload)


@router.get(
    "/{job_id}/comparison",
    response_model=ComparisonResponse,
    response_model_exclude_none=True,
)
def get_scan_comparison(job_id: str) -> ComparisonResponse:
    """
    Compare this scan's domain latest quarter vs most recent prior historical entry.

    Returns ``has_history: false`` when fewer than two quarterly snapshots exist
    (normal for first-time domains).
    """
    comparison = get_comparison_for_scan(job_id)
    if comparison is None:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return ComparisonResponse(**comparison)
