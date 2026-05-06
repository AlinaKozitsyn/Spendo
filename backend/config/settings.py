"""
config/settings.py
==================
Centralised application settings loaded from environment variables.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application-wide configuration."""

    # Legacy provider keys are retained for compatibility but are not used by
    # the primary transaction classifier.
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # Groq is the primary LLM provider for classification.
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    DATA_DIR: Path = Path(os.getenv("SPENDO_DATA_DIR", "data"))
    UPLOADS_DIR: Path = DATA_DIR / "uploads"
    SAMPLES_DIR: Path = DATA_DIR / "samples"
    KNOWLEDGE_DIR: Path = DATA_DIR / "knowledge"

    USE_AI_CLASSIFICATION: bool = os.getenv("USE_AI_CLASSIFICATION", "true").lower() == "true"
    LLM_CLASSIFICATION_MODEL: str = os.getenv("LLM_CLASSIFICATION_MODEL", "llama-3.3-70b-versatile")
    LLM_CLASSIFICATION_FALLBACK_MODEL: str = os.getenv("LLM_CLASSIFICATION_FALLBACK_MODEL", "llama-3.1-8b-instant")

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    def validate(self) -> None:
        """Raise ValueError if required settings are missing."""
        if self.USE_AI_CLASSIFICATION and not self.GROQ_API_KEY:
            raise ValueError(
                "GROQ_API_KEY is required when USE_AI_CLASSIFICATION=true. "
                "Set it in your .env file or disable AI classification."
            )
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        self.KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
