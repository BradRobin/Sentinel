from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.core.config import settings
from app.core.ssrf import SSRFError, validate_scan_url
from app.schemas.findings import ScanCreateRequest, ScanJobResponse, ScanStatusResponse
from app.services.scan_cache import get_cached_scan, invalidate_cached_scan
from app.services.scan_repository import create_scan_record
from app.workers.scan_tasks import get_job_status, run_scan, set_job_status

router = APIRouter(prefix="/scans", tags=["scans"])


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
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if body.force:
        invalidate_cached_scan(validated.original)
    else:
        cached = get_cached_scan(validated.original)
        if cached and cached.get("status") == "complete":
            response.status_code = 200
            # Ensure job status is readable via GET as well
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
            )

    scan_id = create_scan_record(validated.original)
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
    )


@router.get("/{job_id}", response_model=ScanStatusResponse)
def get_scan(job_id: str) -> ScanStatusResponse:
    payload = get_job_status(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return ScanStatusResponse(**payload)
