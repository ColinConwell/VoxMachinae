"""Spotify OAuth integration client."""

from __future__ import annotations

import base64
from urllib.parse import urlencode

import httpx

from voxmachinae.integrations.base import MusicIntegrationProvider, OAuthToken


class SpotifyIntegration(MusicIntegrationProvider):
    provider_name = "spotify"
    authorize_url = "https://accounts.spotify.com/authorize"
    token_url = "https://accounts.spotify.com/api/token"

    def __init__(self, client_id: str, client_secret: str, scopes: list[str] | None = None) -> None:
        if not client_id or not client_secret:
            raise ValueError("Spotify client credentials are required")
        self.client_id = client_id
        self.client_secret = client_secret
        self.scopes = scopes or ["user-read-email", "user-read-private"]

    def build_authorize_url(self, redirect_uri: str, state: str) -> str:
        query = urlencode(
            {
                "response_type": "code",
                "client_id": self.client_id,
                "scope": " ".join(self.scopes),
                "redirect_uri": redirect_uri,
                "state": state,
            }
        )
        return f"{self.authorize_url}?{query}"

    def _basic_auth_header(self) -> str:
        token = f"{self.client_id}:{self.client_secret}".encode("utf-8")
        return "Basic " + base64.b64encode(token).decode("ascii")

    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthToken:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Authorization": self._basic_auth_header()},
            )
            response.raise_for_status()
            data = response.json()
        return OAuthToken(
            access_token=data.get("access_token", ""),
            token_type=data.get("token_type", "Bearer"),
            expires_in=int(data.get("expires_in", 3600)),
            refresh_token=data.get("refresh_token", ""),
            scope=data.get("scope", ""),
            raw=data,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthToken:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                self.token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={"Authorization": self._basic_auth_header()},
            )
            response.raise_for_status()
            data = response.json()
        return OAuthToken(
            access_token=data.get("access_token", ""),
            token_type=data.get("token_type", "Bearer"),
            expires_in=int(data.get("expires_in", 3600)),
            refresh_token=data.get("refresh_token", refresh_token),
            scope=data.get("scope", ""),
            raw=data,
        )
