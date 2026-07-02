from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Migration API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database
    DATABASE_URL: str = "postgresql://app_user:password123@localhost:5432/app_db"
    
    # SMTP
    SMTP_SERVER: str = "smtp.example.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "user"
    SMTP_PASSWORD: str = "password"
    EMAILS_FROM_EMAIL: str = "admin@example.com"
    
    # Storage
    STORAGE_DIR: str = "storage"

    # Biometric Integration Settings
    BIOMETRIC_API_URL: str = "http://209.38.124.237/api/ext/v1"
    BIOMETRIC_API_KEY: str = "default-key"
    BIOMETRIC_TIMEOUT: float = 10.0
    BIOMETRIC_ORGANISATION: str = "NerdShive Workspace Private Limited"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
