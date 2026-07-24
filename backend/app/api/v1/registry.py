"""MCDA registry API — dashboard list + autocomplete suggestions."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.registry import (
    RegistryEntry,
    RegistryListResponse,
    RegistrySuggestion,
    RegistrySuggestionsResponse,
)
from app.services.registry import list_registry_entries, match_registry_suggestions

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
