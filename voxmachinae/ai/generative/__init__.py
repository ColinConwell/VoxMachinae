"""Generative music API integrations."""

from .base import (
    GeneratedTrack,
    GenerationRequest,
    GenerationResult,
    GenerativeEngine,
    TaskStatus,
)
from .kie_suno import KieSunoClient, create_client as create_suno_client
from .stable_audio import StableAudioClient, create_client as create_stable_audio_client
from .elevenlabs_music import ElevenLabsMusicClient, create_client as create_elevenlabs_client

__all__ = [
    "GeneratedTrack",
    "GenerationRequest",
    "GenerationResult",
    "GenerativeEngine",
    "KieSunoClient",
    "StableAudioClient",
    "ElevenLabsMusicClient",
    "TaskStatus",
    "create_suno_client",
    "create_stable_audio_client",
    "create_elevenlabs_client",
]
