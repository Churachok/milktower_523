from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    data_dir: str = "/data"
    ml_base_url: str = "http://ml:8001"
    ml_timeout_seconds: float = 5.0
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    demo_login_enabled: bool = True
    max_upload_bytes: int = 10 * 1024 * 1024
    build_commit: str = "development"
    release_version: str = "1.1.0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
