"""
Application configuration loaded from environment variables.
Uses pydantic-settings for type-safe configuration management.
"""

import json

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    # Application
    APP_NAME: str = "Trading Bot API"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://trading_bot_user:trading_bot_pass@localhost:5432/trading_bot"

    @property
    def async_database_url(self) -> str:
        """Ensure DATABASE_URL uses the asyncpg driver scheme."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Alpaca
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"

    # Authentication
    GOOGLE_CLIENT_ID: str = ""
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # CORS — stored as str so pydantic-settings doesn't try to JSON-parse it
    CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:5175","http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list. Accepts JSON array or comma-separated string."""
        raw = self.CORS_ORIGINS.strip()
        if raw.startswith("["):
            return json.loads(raw)
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    # WebSocket
    WS_PING_INTERVAL: int = 25
    WS_PING_TIMEOUT: int = 60

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


# Singleton settings instance
settings = Settings()
