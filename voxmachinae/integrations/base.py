"""Provider-agnostic music service integration interfaces."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class OAuthToken:
    """OAuth token payload normalized across providers."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 3600
    refresh_token: str = ""
    scope: str = ""
    raw: dict[str, Any] | None = None


class MusicIntegrationProvider(ABC):
    """Abstract base class for OAuth-backed music service integrations."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...

    @abstractmethod
    def build_authorize_url(self, redirect_uri: str, state: str) -> str:
        ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthToken:
        ...

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> OAuthToken:
        ...
