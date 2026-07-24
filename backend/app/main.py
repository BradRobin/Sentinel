import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.api.v1.registry import router as registry_router
from app.api.v1.scans import router as scans_router
from app.core.config import settings
from app.core.database import close_pool
from app.core.redis_client import close_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting Sentinel API (env=%s)", settings.app_env)
    yield
    close_redis()
    close_pool()
    logger.info("Sentinel API shutdown complete")


app = FastAPI(
    title="ICTA Sentinel API",
    description="Government website compliance checker — ICTA.6.002:2019 Section 6.4",
    version=settings.app_version,
    lifespan=lifespan,
)

# Dev browsers often use 127.0.0.1 instead of localhost — both must be allowed
# or the browser surfaces a generic "Failed to fetch" CORS error.
_cors_origins = {
    settings.frontend_url.rstrip("/"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(_cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(health_router, prefix="/api/v1")
app.include_router(scans_router, prefix="/api/v1")
app.include_router(registry_router, prefix="/api/v1")
