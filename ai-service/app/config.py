
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    app_name: str = "AI Support Service"
    port: int = 8000

    # Services
    database_url: str = ""
    backend_url: str = "http://localhost:5000"
    client_url: str = "http://localhost:5173"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"

    # Fallbacks: use only model IDs supported by your API project
    gemini_fallback_models: list[str] = [
        "gemini-3.5-flash-lite",
    ]

    # Retrieval
    top_k: int = 5
    min_score: float = 0.30

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
