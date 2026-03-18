"""Music service integrations (Spotify, TIDAL, etc.)."""

from voxmachinae.integrations.base import MusicIntegrationProvider, OAuthToken
from voxmachinae.integrations.spotify import SpotifyIntegration
from voxmachinae.integrations.tidal import TidalIntegration

__all__ = [
    "MusicIntegrationProvider",
    "OAuthToken",
    "SpotifyIntegration",
    "TidalIntegration",
]
