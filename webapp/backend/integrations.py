"""OAuth integration orchestration for third-party music providers."""

from __future__ import annotations

import os
import secrets
import time
from dataclasses import dataclass
from typing import Any

from voxmachinae.integrations import SpotifyIntegration, TidalIntegration
from voxmachinae.integrations.base import MusicIntegrationProvider, OAuthToken


@dataclass
class OAuthState:
    provider: str
    session_id: str
    created_at: float
    redirect_uri: str


class IntegrationRegistry:
    """Registers providers and tracks OAuth lifecycle state."""

    def __init__(self) -> None:
        self._providers: dict[str, MusicIntegrationProvider] = {}
        self._oauth_states: dict[str, OAuthState] = {}
        self._tokens_by_session: dict[str, dict[str, OAuthToken]] = {}
        self._load_from_env()

    def _load_from_env(self) -> None:
        spotify_id = os.getenv("SPOTIFY_CLIENT_ID", "")
        spotify_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
        if spotify_id and spotify_secret:
            self._providers["spotify"] = SpotifyIntegration(spotify_id, spotify_secret)

        tidal_id = os.getenv("TIDAL_CLIENT_ID", "")
        tidal_secret = os.getenv("TIDAL_CLIENT_SECRET", "")
        if tidal_id and tidal_secret:
            self._providers["tidal"] = TidalIntegration(tidal_id, tidal_secret)

    def providers(self) -> list[str]:
        return sorted(self._providers.keys())

    def issue_authorization_url(self, provider: str, session_id: str, redirect_uri: str) -> dict[str, str]:
        client = self._providers.get(provider)
        if client is None:
            raise ValueError(f"Provider '{provider}' is not configured")
        state = secrets.token_urlsafe(24)
        self._oauth_states[state] = OAuthState(
            provider=provider,
            session_id=session_id,
            created_at=time.time(),
            redirect_uri=redirect_uri,
        )
        return {"state": state, "authorization_url": client.build_authorize_url(redirect_uri, state)}

    def pop_state(self, state: str) -> OAuthState | None:
        return self._oauth_states.pop(state, None)

    async def exchange_code(self, state: OAuthState, code: str) -> OAuthToken:
        client = self._providers[state.provider]
        token = await client.exchange_code(code=code, redirect_uri=state.redirect_uri)
        session_tokens = self._tokens_by_session.setdefault(state.session_id, {})
        session_tokens[state.provider] = token
        return token

    async def refresh(self, provider: str, session_id: str) -> OAuthToken:
        session_tokens = self._tokens_by_session.get(session_id, {})
        existing = session_tokens.get(provider)
        if existing is None or not existing.refresh_token:
            raise ValueError("No refresh token available")
        client = self._providers.get(provider)
        if client is None:
            raise ValueError(f"Provider '{provider}' is not configured")
        refreshed = await client.refresh_access_token(existing.refresh_token)
        session_tokens[provider] = refreshed
        return refreshed

    def status(self, session_id: str) -> dict[str, Any]:
        session_tokens = self._tokens_by_session.get(session_id, {})
        return {
            "configured_providers": self.providers(),
            "connected_providers": sorted(session_tokens.keys()),
        }
