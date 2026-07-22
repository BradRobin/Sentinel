from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.ssrf import SSRFError, validate_scan_url
from app.schemas.findings import ScanCreateRequest, ScanJobResponse, ScanStatusResponse
from app.workers.scan_tasks import get_job_status, run_scan, set_job_status

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("", response_model=ScanJobResponse, status_code=202)
def create_scan(body: ScanCreateRequest) -> ScanJobResponse:
    allowed_tlds = [t.strip() for t in settings.allowed_tld.split(",") if t.strip()]
    try:
        validated = validate_scan_url(
            body.url,
            allowed_tlds=allowed_tlds,
            allow_tld_bypass=settings.allow_tld_bypass,
        )
    except SSRFError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job_id = str(uuid.uuid4())
    set_job_status(
        job_id,
        {"job_id": job_id, "status": "queued", "url": validated.original, "result": None, "error": None},
    )
    run_scan.delay(job_id, validated.original)

    return ScanJobResponse(job_id=job_id, status="queued", url=validated.original)


@router.get("/{job_id}", response_model=ScanStatusResponse)
def get_scan(job_id: str) -> ScanStatusResponse:
    payload = get_job_status(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return ScanStatusResponse(**payload)
