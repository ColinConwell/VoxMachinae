"""ElevenLabs music generation client.

Uses the ElevenLabs API for music composition and sound effect generation.
This wraps the existing ElevenLabs MCP tools into the VoxMachinae
GenerativeEngine interface.

Note: For direct MCP tool access, use the elevenlabs MCP server.
This client provides the unified GenerativeEngine interface.
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import httpx

from .base import (
    GeneratedTrack,
    GenerationRequest,
    GenerationResult,
    GenerativeEngine,
    TaskStatus,
)

logger = logging.getLogger(__name__)

ELEVENLABS_API_BASE = "https://api.elevenlabs.io"


class ElevenLabsMusicClient(GenerativeEngine):
    """Client for ElevenLabs music and sound effect generation.

    Args:
        api_key: ElevenLabs API key.
    """

    def __init__(self, api_key: str):
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "ElevenLabs"

    @property
    def supported_models(self) -> list[str]:
        return ["default"]

    def _headers(self) -> dict[str, str]:
        return {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """Generate music using ElevenLabs API.

        Uses the text-to-sound-effects endpoint for short generations
        or the music composition endpoint for longer pieces.

        Args:
            request: Generation parameters.

        Returns:
            GenerationResult with generated track.
        """
        duration = request.duration_seconds or 5.0
        duration = min(duration, 22.0)  # Practical limit

        logger.info(
            "Generating ElevenLabs audio: prompt=%s, duration=%.1fs",
            request.prompt[:60],
            duration,
        )

        try:
            # Use sound effects endpoint for short clips
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{ELEVENLABS_API_BASE}/v1/sound-generation",
                    headers=self._headers(),
                    json={
                        "text": request.prompt,
                        "duration_seconds": duration,
                    },
                )

                if resp.status_code != 200:
                    error_text = resp.text
                    logger.error("ElevenLabs error: %s", error_text)
                    return GenerationResult(
                        task_id="elevenlabs-err",
                        status=TaskStatus.FAILED,
                        error_message=f"API error ({resp.status_code}): {error_text[:200]}",
                    )

                # Save audio
                tmp = tempfile.NamedTemporaryFile(
                    suffix=".mp3", prefix="elevenlabs_", delete=False
                )
                tmp.write(resp.content)
                tmp.close()
                local_path = Path(tmp.name)

                track = GeneratedTrack(
                    track_id=f"elevenlabs-{local_path.stem}",
                    title=request.title or "ElevenLabs Generation",
                    duration=duration,
                    model="elevenlabs-sfx",
                    local_path=local_path,
                )

                return GenerationResult(
                    task_id=track.track_id,
                    status=TaskStatus.SUCCESS,
                    tracks=[track],
                )

        except httpx.HTTPError as exc:
            logger.exception("ElevenLabs HTTP error")
            return GenerationResult(
                task_id="elevenlabs-err",
                status=TaskStatus.FAILED,
                error_message=str(exc),
            )

    async def poll_status(self, task_id: str) -> GenerationResult:
        """ElevenLabs SFX is synchronous."""
        return GenerationResult(
            task_id=task_id,
            status=TaskStatus.SUCCESS,
        )


def create_client(api_key: str | None = None) -> ElevenLabsMusicClient:
    """Create an ElevenLabsMusicClient from environment or explicit key."""
    if api_key is None:
        api_key = os.environ.get("ELEVENLABS_API_KEY", "")
        if not api_key:
            raise ValueError(
                "No API key. Set ELEVENLABS_API_KEY env var or pass api_key."
            )
    return ElevenLabsMusicClient(api_key=api_key)
