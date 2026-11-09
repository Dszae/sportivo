from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import field_validator
import os


class Settings(BaseSettings):
    APP_NAME: str = "Sportivo API"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    PORT: int = 8000
    
    # PostgreSQL Configuration (Async)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://sportivo:sportivo_secret@localhost:5432/sportivo_db"
    )
    
    # Redis Cache Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # CORS Origins
    CORS_ORIGINS: Union[str, List[str]] = "*"

    @field_validator("CORS_ORIGINS")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            if v == "*":
                return ["*"]
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        return ["*"]

    # Upstream data sources
    LIVE_CREX_ENDPOINT: str = "https://cricket-data.crex.live/v2/cricket/match/full-scorecard?matchId=np_t20_2026_m19"
    STREAM_INDEX_ENDPOINT: str = "https://yonotv.pages.dev/LINK"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
