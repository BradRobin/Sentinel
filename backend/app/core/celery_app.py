from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "sentinel",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.scan_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Nairobi",
    enable_utc=True,
    worker_concurrency=settings.celery_worker_concurrency,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
