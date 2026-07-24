"""Pydantic schemas for the MCDA registry API."""

from typing import Literal

from pydantic import BaseModel, Field


class RegistryEntry(BaseModel):
    domain_id: str
    org_id: str
    org_name: str
    org_type: Literal["ministry", "county", "agency"]
    sector: str | None = None
    url: str
    registered_name: str | None = None
    aliases: list[str] = Field(default_factory=list)
    latest_score: float | None = None
    previous_score: float | None = None
    last_checked_at: str | None = None
    last_source: str | None = None
    trend: Literal["up", "down", "flat", "unknown"] = "unknown"
    score_delta: float | None = None


class RegistryListResponse(BaseModel):
    count: int
    items: list[RegistryEntry]


class RegistrySuggestion(BaseModel):
    name: str
    org_name: str
    url: str
    aliases: list[str] = Field(default_factory=list)


class RegistrySuggestionsResponse(BaseModel):
    items: list[RegistrySuggestion]
