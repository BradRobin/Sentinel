from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FindingStatus(str, Enum):
    pass_ = "pass"
    fail = "fail"
    manual_review = "manual_review"


class Finding(BaseModel):
    category: str
    check_name: str
    clause_reference: str
    status: FindingStatus
    severity: Literal["high", "medium", "low"]
    automatability_type: Literal["A", "P", "M"]
    detail: dict = Field(default_factory=dict)


class ScanCreateRequest(BaseModel):
    url: str
    force: bool = False


class ScanJobResponse(BaseModel):
    job_id: str
    status: str
    url: str
    cache_hit: bool = False
    progress: str | None = None


class ScanStatusResponse(BaseModel):
    job_id: str
    status: str
    url: str | None = None
    result: dict | None = None
    error: str | None = None
    cache_hit: bool = False
    progress: str | None = None


class FindingResponse(BaseModel):
    category: str
    check_name: str
    clause_reference: str
    status: str
    severity: str
    automatability_type: str
    detail: dict = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    version: str
    redis: str
    db: str
