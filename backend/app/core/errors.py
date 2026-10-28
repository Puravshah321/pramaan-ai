"""Standardised error types for Pramaan AI.

All API errors use the shape: {code, message, hint, request_id}.
Never expose internal paths or stack traces in API responses.
"""
from __future__ import annotations

from http import HTTPStatus
from typing import Any


class PramaanError(Exception):
    """Base exception for all Pramaan AI errors."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, hint: str = "", **extras: Any) -> None:
        super().__init__(message)
        self.message = message
        self.hint = hint
        self.extras = extras

    def to_dict(self, request_id: str = "-") -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "hint": self.hint,
            "request_id": request_id,
            **self.extras,
        }


class NotFoundError(PramaanError):
    status_code = 404
    code = "not_found"


class ValidationError(PramaanError):
    status_code = 422
    code = "validation_error"


class InfeasibleConfigError(PramaanError):
    """Raised when a config exceeds hardware limits."""
    status_code = 422
    code = "infeasible_config"


class CacheInvalidationError(PramaanError):
    """Raised when a stale cache entry is detected."""
    status_code = 409
    code = "cache_invalidation"


class UploadError(PramaanError):
    status_code = 400
    code = "upload_error"


class ModelNotFoundError(PramaanError):
    """Raised when a model file is missing (shows the download command)."""
    status_code = 404
    code = "model_not_found"


class OOMError(PramaanError):
    """Out-of-memory during a run. Recorded as a result, not a crash."""
    status_code = 500
    code = "oom"


class DemoModeError(PramaanError):
    """Raised when a real-mode operation is attempted in Demo Mode."""
    status_code = 403
    code = "demo_mode_blocked"
