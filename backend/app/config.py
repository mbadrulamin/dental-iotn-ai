"""
Application configuration using Pydantic Settings.
"""

from functools import lru_cache
from typing import List
import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    # Application
    app_name: str = "Dental IOTN AI Platform"
    app_env: str = "development"
    debug: bool = True
    
    # Database
    database_url: str = "postgresql+asyncpg://admin:dev_password@localhost:5432/dental_iotn"
    
    # JWT Authentication
    jwt_secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    
    # AI Models
    models_dir: str = "./models"
    device: str = "cuda"  # cuda or cpu
    
    # File Storage
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50
    
    # CORS
    cors_origins: str = '["http://localhost:3000","http://127.0.0.1:3000"]'
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from JSON string."""
        return json.loads(self.cors_origins)
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
