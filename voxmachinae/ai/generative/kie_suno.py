"""Kie AI / Suno API client for music generation.

Wraps the Kie AI proxy API (https://api.kie.ai) which provides access
to Suno's music generation models (V4, V4.5, V4.5+, V4.5ALL, V5).

Features:
- Text-to-music generation (with or without vocals)
- Task status polling
- Track downloading
- Vocal separation (stem splitting)
- Lyrics generation

All operations are async. Generation requests return a task ID
immediately; results are retrieved via polling.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

from .base import (
    GeneratedTrack,
    GenerationRequest,
    GenerationResult,
    GenerativeEngine,
    TaskStatus,
)

logger = logging.getLogger(__name__)

# API configuration
KIE_API_BASE = "https://api.kie.ai"

# Model mapping
SUNO_MODELS = {
    "v4": "V4",
    "v4.5": "V4_5",
    "v4.5+": "V4_5PLUS",
    "v4.5all": "V4_5ALL",
    "v5": "V5",
}

# Status mapping from Kie AI to our enum
_STATUS_MAP = {
    "PENDING": TaskStatus.PENDING,
    "TEXT_SUCCESS": TaskStatus.PROCESSING,
    "FIRST_SUCCESS": TaskStatus.PROCESSING,
    "SUCCESS": TaskStatus.SUCCESS,
    "CREATE_TASK_FAILED": TaskStatus.FAILED,
    "GENERATE_AUDIO_FAILED": TaskStatus.FAILED,
    "CALLBACK_EXCEPTION": TaskStatus.FAILED,
    "SENSITIVE_WORD_ERROR": TaskStatus.FAILED,
}


class KieSunoClient(GenerativeEngine):
    """Client for Kie AI's Suno API proxy.

    Args:
        api_key: Kie AI API key.
        default_model: Default Suno model version.
        callback_url: Default webhook URL for task completion.
    """

    def __init__(
        self,
        api_key: str,
        default_model: str = "v4",
        callback_url: str = "",
    ):
        self._api_key = api_key
        self._default_model = default_model
        self._callback_url = callback_url

    @property
    def name(self) -> str:
        return "Kie AI / Suno"

    @property
    def supported_models(self) -> list[str]:
        return list(SUNO_MODELS.keys())

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _resolve_model(self, model: str) -> str:
        """Resolve a friendly model name to the API model string."""
        if not model:
            model = self._default_model
        model_lower = model.lower().strip()
        if model_lower in SUNO_MODELS:
            return SUNO_MODELS[model_lower]
        # If already in API format (e.g., "V4_5"), pass through
        if model.upper() in SUNO_MODELS.values():
            return model.upper()
        raise ValueError(
            f"Unknown model '{model}'. Supported: {list(SUNO_MODELS.keys())}"
        )

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """Submit a music generation request to Suno via Kie AI.

        Args:
            request: Generation parameters.

        Returns:
            GenerationResult with task_id for polling.
        """
        model = self._resolve_model(request.model)
        callback = request.callback_url or self._callback_url

        body: dict[str, Any] = {
            "prompt": request.prompt,
            "customMode": request.custom_mode,
            "instrumental": request.instrumental,
            "model": model,
            "callBackUrl": callback or "https://example.com/noop",
        }

        if request.custom_mode:
            if request.style:
                body["style"] = request.style
            if request.title:
                body["title"] = request.title
        if request.negative_tags:
            body["negativeTags"] = request.negative_tags
        if request.vocal_gender:
            body["vocalGender"] = request.vocal_gender

        # Merge any extra params
        body.update(request.extra)

        logger.info("Submitting Suno generation: model=%s, prompt=%s...", model, request.prompt[:60])

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{KIE_API_BASE}/api/v1/generate",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != 200:
            return GenerationResult(
                task_id="",
                status=TaskStatus.FAILED,
                error_message=data.get("msg", "Unknown error"),
                raw_response=data,
            )

        task_id = data["data"]["taskId"]
        logger.info("Generation submitted: taskId=%s", task_id)

        return GenerationResult(
            task_id=task_id,
            status=TaskStatus.PENDING,
            raw_response=data,
        )

    async def poll_status(self, task_id: str) -> GenerationResult:
        """Check the status of a generation task.

        Args:
            task_id: The task ID from generate().

        Returns:
            Updated GenerationResult.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{KIE_API_BASE}/api/v1/generate/record-info",
                headers=self._headers(),
                params={"taskId": task_id},
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != 200:
            return GenerationResult(
                task_id=task_id,
                status=TaskStatus.FAILED,
                error_message=data.get("msg", "Unknown error"),
                raw_response=data,
            )

        task_data = data.get("data") or {}
        response_data = task_data.get("response") or {}
        raw_status = task_data.get("status", "PENDING")
        status = _STATUS_MAP.get(raw_status, TaskStatus.PENDING)

        tracks: list[GeneratedTrack] = []
        for suno_track in (response_data.get("sunoData") or []):
            tracks.append(
                GeneratedTrack(
                    track_id=suno_track.get("id", ""),
                    title=suno_track.get("title", ""),
                    audio_url=suno_track.get("audioUrl", ""),
                    stream_url=suno_track.get("streamAudioUrl", ""),
                    image_url=suno_track.get("imageUrl", ""),
                    duration=suno_track.get("duration", 0.0),
                    model=suno_track.get("modelName", ""),
                    tags=suno_track.get("tags", ""),
                    lyrics=suno_track.get("prompt", ""),
                )
            )

        return GenerationResult(
            task_id=task_id,
            status=status,
            tracks=tracks,
            error_message=task_data.get("errorMessage", "") or "",
            raw_response=data,
        )

    async def generate_and_wait(
        self,
        request: GenerationRequest,
        timeout: float = 300.0,
        poll_interval: float = 8.0,
    ) -> GenerationResult:
        """Generate music and wait for completion.

        Convenience method that combines generate() + wait_for_completion().

        Args:
            request: Generation parameters.
            timeout: Max wait time in seconds.
            poll_interval: Seconds between status checks.

        Returns:
            Final GenerationResult with tracks.
        """
        result = await self.generate(request)
        if result.status == TaskStatus.FAILED:
            return result
        return await self.wait_for_completion(
            result.task_id, timeout=timeout, poll_interval=poll_interval
        )

    async def generate_vocal_sample(
        self,
        description: str,
        style: str = "acapella, vocal, clean",
        title: str = "Vocal Sample",
        model: str = "v4",
        gender: str = "",
    ) -> GenerationResult:
        """Generate a vocal-focused sample optimized for VoxMachina effects.

        This is a convenience method that sets up parameters specifically
        for generating vocal content suitable for auto-tune/vocoder processing.

        Args:
            description: Lyrics or description of the vocal content.
            style: Musical style tags.
            title: Track title.
            model: Suno model version.
            gender: Vocal gender ('m' or 'f').

        Returns:
            GenerationResult from generate().
        """
        request = GenerationRequest(
            prompt=description,
            style=style,
            title=title,
            instrumental=False,
            model=model,
            custom_mode=True,
            vocal_gender=gender,
        )
        return await self.generate(request)

    async def separate_vocals(self, audio_url: str) -> GenerationResult:
        """Separate vocals from an audio track using Kie AI's separation API.

        Args:
            audio_url: URL of the audio to separate.

        Returns:
            GenerationResult with separated stems.
        """
        body = {
            "audioUrl": audio_url,
            "callBackUrl": self._callback_url or "https://example.com/noop",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{KIE_API_BASE}/api/v1/vocal-removal/generate",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != 200:
            return GenerationResult(
                task_id="",
                status=TaskStatus.FAILED,
                error_message=data.get("msg", "Unknown error"),
                raw_response=data,
            )

        return GenerationResult(
            task_id=data["data"]["taskId"],
            status=TaskStatus.PENDING,
            raw_response=data,
        )

    async def generate_lyrics(
        self,
        prompt: str,
    ) -> GenerationResult:
        """Generate lyrics for a given prompt.

        Args:
            prompt: Description of desired lyrics.

        Returns:
            GenerationResult with lyrics in tracks[0].lyrics.
        """
        body = {
            "prompt": prompt,
            "callBackUrl": self._callback_url or "https://example.com/noop",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{KIE_API_BASE}/api/v1/lyrics/generate",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != 200:
            return GenerationResult(
                task_id="",
                status=TaskStatus.FAILED,
                error_message=data.get("msg", "Unknown error"),
                raw_response=data,
            )

        return GenerationResult(
            task_id=data["data"]["taskId"],
            status=TaskStatus.PENDING,
            raw_response=data,
        )


def create_client(
    api_key: str | None = None,
    default_model: str = "v4",
    callback_url: str = "",
) -> KieSunoClient:
    """Create a KieSunoClient from environment or explicit key.

    Args:
        api_key: Kie AI API key. Falls back to KIE_API_KEY env var.
        default_model: Default Suno model version.
        callback_url: Default webhook callback URL.

    Returns:
        Configured KieSunoClient.
    """
    if api_key is None:
        import os
        api_key = os.environ.get("KIE_API_KEY", "")
        if not api_key:
            raise ValueError(
                "No API key provided. Set KIE_API_KEY environment variable "
                "or pass api_key parameter."
            )

    return KieSunoClient(
        api_key=api_key,
        default_model=default_model,
        callback_url=callback_url,
    )
