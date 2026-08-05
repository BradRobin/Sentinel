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
    hq_county: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    latest_score: float | None = None
    previous_score: float | None = None
    category_breakdown: dict[str, float] = Field(default_factory=dict)
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


class RegistryScanJob(BaseModel):
    job_id: str
    url: str
    domain_id: str
    action: Literal["queued", "attached"]


class RegistryScanEnqueueResponse(BaseModel):
    batch_id: str
    domain_count: int
    queued: int
    attached_in_flight: int
    skipped_lock: int
    concurrency: int
    triggered_type: Literal["manual", "scheduled"]
    jobs: list[RegistryScanJob]
    resumed: bool = False


class RegistryScanBatchJobStatus(BaseModel):
    job_id: str
    url: str | None = None
    domain_id: str | None = None
    action: str | None = None
    status: Literal["queued", "running", "complete", "failed", "unknown"]
    progress: str | None = None
    error: str | None = None


class RegistryScanBatchCounts(BaseModel):
    queued: int = 0
    running: int = 0
    complete: int = 0
    failed: int = 0
    unknown: int = 0


class RegistryScanBatchStatusResponse(BaseModel):
    batch_id: str
    triggered_type: Literal["manual", "scheduled"] | None = None
    domain_count: int
    done: bool
    counts: RegistryScanBatchCounts
    jobs: list[RegistryScanBatchJobStatus]
