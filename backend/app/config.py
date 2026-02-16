"""
Application configuration loaded from environment variables.
Uses pydantic-settings for type-safe configuration management.
"""

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

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Alpaca
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:5175", "http://localhost:3000"]

    # WebSocket
    WS_PING_INTERVAL: int = 25
    WS_PING_TIMEOUT: int = 60

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


# Singleton settings instance
settings = Settings()
