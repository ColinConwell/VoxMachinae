"""Stability AI Stable Audio client for music/SFX generation.

Uses the Stability AI REST API to generate audio from text prompts.
Supports up to 47 seconds of 44.1kHz stereo audio.

Docs: https://platform.stability.ai/docs/api-reference#tag/Generate/paths/~1v1~1generation~1stable-audio~1text-to-audio/post
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

STABILITY_API_BASE = "https://api.stability.ai"


class StableAudioClient(GenerativeEngine):
    """Client for Stability AI's Stable Audio API.

    Args:
        api_key: Stability AI API key.
    """

    def __init__(self, api_key: str):
        self._api_key = api_key

    @property
    def name(self) -> str:
        return "Stable Audio"

    @property
    def supported_models(self) -> list[str]:
        return ["stable-audio-open-1.0"]

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "audio/*",
        }

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """Generate audio from a text prompt.

        Stable Audio is synchronous — the response contains the audio directly.
        We save it to a temp file and return immediately with SUCCESS status.

        Args:
            request: Generation parameters.

        Returns:
            GenerationResult with a single track (local_path set).
        """
        duration = request.duration_seconds or 30.0
        duration = min(duration, 47.0)  # Max 47s

        logger.info(
            "Generating Stable Audio: prompt=%s, duration=%.1fs",
            request.prompt[:60],
            duration,
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{STABILITY_API_BASE}/v1/generation/stable-audio/text-to-audio",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                    },
                    data={
                        "text_prompts[0][text]": request.prompt,
                        "text_prompts[0][weight]": "1.0",
                        "duration_seconds": str(duration),
                    },
                )

                if resp.status_code != 200:
                    error_text = resp.text
                    logger.error("Stable Audio error: %s", error_text)
                    return GenerationResult(
                        task_id="stable-audio-err",
                        status=TaskStatus.FAILED,
                        error_message=f"API error ({resp.status_code}): {error_text[:200]}",
                    )

                # Save audio to temp file
                suffix = ".wav"
                content_type = resp.headers.get("content-type", "")
                if "mp3" in content_type or "mpeg" in content_type:
                    suffix = ".mp3"

                tmp = tempfile.NamedTemporaryFile(
                    suffix=suffix, prefix="stable_audio_", delete=False
                )
                tmp.write(resp.content)
                tmp.close()
                local_path = Path(tmp.name)

                track = GeneratedTrack(
                    track_id=f"stable-{local_path.stem}",
                    title=request.title or "Stable Audio",
                    duration=duration,
                    model="stable-audio-open-1.0",
                    local_path=local_path,
                )

                return GenerationResult(
                    task_id=track.track_id,
                    status=TaskStatus.SUCCESS,
                    tracks=[track],
                )

        except httpx.HTTPError as exc:
            logger.exception("Stable Audio HTTP error")
            return GenerationResult(
                task_id="stable-audio-err",
                status=TaskStatus.FAILED,
                error_message=str(exc),
            )

    async def poll_status(self, task_id: str) -> GenerationResult:
        """Stable Audio is synchronous, so polling always returns the last result."""
        return GenerationResult(
            task_id=task_id,
            status=TaskStatus.SUCCESS,
        )


def create_client(api_key: str | None = None) -> StableAudioClient:
    """Create a StableAudioClient from environment or explicit key."""
    if api_key is None:
        api_key = os.environ.get("STABILITY_API_KEY", "")
        if not api_key:
            raise ValueError(
                "No API key. Set STABILITY_API_KEY env var or pass api_key."
            )
    return StableAudioClient(api_key=api_key)
