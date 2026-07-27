from __future__ import annotations

from fastapi import APIRouter, HTTPException, Header, Query

from app.core.database import get_connection
from app.data.manual_check_registry import ManualCheckType
from app.schemas.findings import (
    ManualReviewItemDetail,
    ManualReviewQueueItem,
    ManualReviewResolveRequest,
    ManualReviewResolveResponse,
)
from app.services.manual_review import (
    get_manual_review_item,
    list_pending_manual_review_items,
    resolve_manual_review_item,
)

router = APIRouter(prefix="/manual-review", tags=["manual-review"])

_VALID_CHECK_TYPES: frozenset[str] = frozenset({"site_inspection", "institutional_attestation"})


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


def _parse_check_type(raw: str | None) -> ManualCheckType | None:
    if raw is None or raw == "":
        return None
    if raw not in _VALID_CHECK_TYPES:
        raise HTTPException(
            status_code=422,
            detail={
                "message": (
                    "check_type must be site_inspection or institutional_attestation"
                )
            },
        )
    return raw  # type: ignore[return-value]


@router.get(
    "/items",
    response_model=list[ManualReviewQueueItem],
)
def list_queue_items(
    x_officer_id: str | None = Header(default=None, alias="x-officer-id"),
    check_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    domain_id: str | None = Query(default=None),
    domain_query: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
):
    officer_id = _require_officer_id(x_officer_id)
    if not _officer_exists(officer_id):
        raise HTTPException(status_code=401, detail={"message": "Unknown officer"})

    parsed_check_type = _parse_check_type(check_type)
    return list_pending_manual_review_items(
        check_type=parsed_check_type,
        category=category,
        domain_id=domain_id,
        domain_query=domain_query,
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
