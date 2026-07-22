from fastapi import APIRouter

from app.core.config import settings
from app.core.database import check_db
from app.core.redis_client import check_redis
from app.schemas.findings import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    redis_ok = check_redis()
    db_ok = check_db()
    all_ok = redis_ok and db_ok
    return HealthResponse(
        status="ok" if all_ok else "degraded",
        version=settings.app_version,
        redis="ok" if redis_ok else "error",
        db="ok" if db_ok else "error",
    )
