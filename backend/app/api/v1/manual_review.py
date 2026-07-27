from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header, Query

from app.core.database import get_connection
from app.schemas.findings import (
    ManualReviewItemDetail,
    ManualReviewQueueItem,
    ManualReviewResolveRequest,
    ManualReviewResolveResponse,
)
from app.services.manual_review import (
    list_pending_manual_review_items,
    resolve_manual_review_item,
    get_manual_review_item,
)

router = APIRouter(prefix="/manual-review", tags=["manual-review"])


def _require_officer_id(x_officer_id: str | None) -> str:
    if not x_officer_id:
        raise HTTPException(
            status_code=401,
            detail={"message": "Missing officer auth header: x-officer-id"},
        )
    officer_id = x_officer_id.strip()
    if not officer_id:
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid x-officer-id"},
        )
    return officer_id


def _officer_exists(officer_id: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM officers WHERE id = %s",
            (officer_id,),
        ).fetchone()
    return bool(row)


@router.get(
    "/items",
    response_model=list[ManualReviewQueueItem],
)
def list_queue_items(
    x_officer_id: str | None = Header(default=None, alias="x-officer-id"),
    check_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    domain_id: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    officer_id = _require_officer_id(x_officer_id)
    if not _officer_exists(officer_id):
        raise HTTPException(status_code=401, detail={"message": "Unknown officer"})

    # check_type is validated downstream by SQL filters; keep it permissive in v1.
    return list_pending_manual_review_items(
        officer_id=officer_id,
        check_type=check_type,  # type: ignore[arg-type]
        category=category,
        domain_id=domain_id,
        limit=limit,
    )


@router.get(
    "/items/{item_id}",
    response_model=ManualReviewItemDetail,
)
def get_item_detail(
    item_id: str,
    x_officer_id: str | None = Header(default=None, alias="x-officer-id"),
):
    officer_id = _require_officer_id(x_officer_id)
    if not _officer_exists(officer_id):
        raise HTTPException(status_code=401, detail={"message": "Unknown officer"})

    item = get_manual_review_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail={"message": "Item not found"})
    return item  # type: ignore[return-value]


@router.post(
    "/items/{item_id}/resolve",
    response_model=ManualReviewResolveResponse,
)
def resolve_item(
    item_id: str,
    body: ManualReviewResolveRequest,
    x_officer_id: str | None = Header(default=None, alias="x-officer-id"),
):
    officer_id = _require_officer_id(x_officer_id)
    if not _officer_exists(officer_id):
        raise HTTPException(status_code=401, detail={"message": "Unknown officer"})

    justification = (body.justification or "").strip()
    if len(justification) < 15:
        raise HTTPException(
            status_code=400,
            detail={"message": "Justification must be at least 15 characters"},
        )

    try:
        updated = resolve_manual_review_item(
            item_id=item_id,
            officer_id=officer_id,
            resolved_status=body.current_status,
            justification=justification,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail={"message": str(exc)}) from exc

    return ManualReviewResolveResponse(ok=True, item_id=str(updated["id"]))

