"""
config/settings.py
==================
Centralised application settings loaded from environment variables.

WHY A CONFIG MODULE?
  - All env var access goes through one place → easy to audit and mock in tests.
  - Fail fast: missing required vars raise an error at startup, not mid-request.
  - Type-safe defaults.
"""

import os
from pathlib import Path


class Settings:
    """Application-wide configuration."""

    # -- Anthropic --
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # -- File paths --
    DATA_DIR: Path = Path(os.getenv("SPENDO_DATA_DIR", "data"))
    UPLOADS_DIR: Path = DATA_DIR / "uploads"
    SAMPLES_DIR: Path = DATA_DIR / "samples"

    # -- Classification --
    # Set to "false" to disable AI fallback (useful for offline / test environments)
    USE_AI_CLASSIFICATION: bool = os.getenv("USE_AI_CLASSIFICATION", "true").lower() == "true"

    # -- Logging --
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    def validate(self) -> None:
        """
        Raise ValueError if any required setting is missing.
        Call this once at application startup.
        """
        if self.USE_AI_CLASSIFICATION and not self.ANTHROPIC_API_KEY:
            raise ValueError(
                "ANTHROPIC_API_KEY is required when USE_AI_CLASSIFICATION=true. "
                "Set it in your .env file or disable AI classification."
            )
        self.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# Module-level singleton — import and use directly
settings = Settings()
