from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_version: str = "0.1.0"
    frontend_url: str = "http://localhost:3000"
    database_url: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    redis_url: str = "redis://localhost:6379/0"
    celery_worker_concurrency: int = 2
    scan_cache_ttl_seconds: int = 86400
    allowed_tld: str = ".go.ke,.gov.ke"
    allow_tld_bypass: bool = False
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    anthropic_api_key: str = ""


settings = Settings()
