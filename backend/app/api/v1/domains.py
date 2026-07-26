"""Domain-scoped endpoints (comparison / history)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.findings import (
    ComparisonAvailabilityResponse,
    ComparisonResponse,
)
from app.services.historical import (
    COMPARISON_PERIODS,
    available_periods_for_domain,
    get_comparison_for_domain,
    normalize_period,
)

router = APIRouter(prefix="/domains", tags=["domains"])


@router.get(
    "/{domain_id}/comparison",
    response_model=ComparisonResponse,
    response_model_exclude_none=True,
)
def get_domain_comparison(
    domain_id: str,
    period: str = Query(
        default="quarter",
        description="Look-back period: " + ", ".join(COMPARISON_PERIODS),
    ),
) -> ComparisonResponse:
    """
    Compare the domain's latest score snapshot to the closest snapshot at or
    before ``latest − period``.
    """
    try:
        normalize_period(period)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ComparisonResponse(
        **get_comparison_for_domain(domain_id, period=period)
    )


@router.get(
    "/{domain_id}/comparison/availability",
    response_model=ComparisonAvailabilityResponse,
)
def get_domain_comparison_availability(
    domain_id: str,
) -> ComparisonAvailabilityResponse:
    return ComparisonAvailabilityResponse(
        **available_periods_for_domain(domain_id)
    )
