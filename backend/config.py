from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    redis_url: str
    secret_key: str
    access_token_expire_minutes: int = 1440
    groq_api_key: str
    webhook_secret: str  # Meta App Secret for X-Hub-Signature-256 verification
    webhook_verify_token: str  # arbitrary string you set in Meta Developer Portal
    allowed_origins: str = "http://localhost:3000"
    email_from: str = ""
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    lbp_rate: int = 90000
    sentry_dsn: str = ""

    class Config:
        env_file = str(Path(__file__).parent.parent / ".env")
        extra = "ignore"  # allow TEST_DATABASE_URL and other non-Settings keys in .env


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
