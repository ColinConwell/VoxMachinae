"""Abstract base interface for generative music API clients.

All generative API clients (Kie AI/Suno, ElevenLabs, Stable Audio)
implement this interface for a unified experience.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class TaskStatus(str, Enum):
    """Status of an async generation task."""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class GeneratedTrack:
    """A single generated audio track."""

    track_id: str
    title: str = ""
    audio_url: str = ""
    stream_url: str = ""
    image_url: str = ""
    duration: float = 0.0
    model: str = ""
    tags: str = ""
    lyrics: str = ""
    local_path: Optional[Path] = None

    @property
    def is_downloaded(self) -> bool:
        return self.local_path is not None and self.local_path.exists()


@dataclass
class GenerationResult:
    """Result of a music generation task."""

    task_id: str
    status: TaskStatus = TaskStatus.PENDING
    tracks: list[GeneratedTrack] = field(default_factory=list)
    error_message: str = ""
    raw_response: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationRequest:
    """Parameters for a music generation request."""

    prompt: str
    style: str = ""
    title: str = ""
    instrumental: bool = False
    model: str = ""
    duration_seconds: float = 0.0
    custom_mode: bool = False
    negative_tags: str = ""
    vocal_gender: str = ""  # 'm' or 'f'
    callback_url: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


class GenerativeEngine(ABC):
    """Abstract base class for generative music API clients."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the engine."""
        ...

    @property
    @abstractmethod
    def supported_models(self) -> list[str]:
        """List of supported model identifiers."""
        ...

    @abstractmethod
    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """Submit a generation request.

        Returns a GenerationResult with task_id. The task is async --
        use poll_status() or wait_for_completion() to get results.
        """
        ...

    @abstractmethod
    async def poll_status(self, task_id: str) -> GenerationResult:
        """Check the status of a generation task."""
        ...

    async def wait_for_completion(
        self,
        task_id: str,
        timeout: float = 300.0,
        poll_interval: float = 5.0,
    ) -> GenerationResult:
        """Wait for a generation task to complete.

        Args:
            task_id: The task ID to wait for.
            timeout: Maximum wait time in seconds.
            poll_interval: Time between status checks in seconds.

        Returns:
            Final GenerationResult.

        Raises:
            TimeoutError: If task doesn't complete within timeout.
        """
        elapsed = 0.0
        while elapsed < timeout:
            result = await self.poll_status(task_id)
            if result.status in (TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.CANCELLED):
                return result
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        raise TimeoutError(
            f"Generation task {task_id} did not complete within {timeout}s"
        )

    async def download_track(
        self,
        track: GeneratedTrack,
        output_dir: Path,
        filename: str | None = None,
    ) -> Path:
        """Download a generated track to a local file.

        Args:
            track: The track to download.
            output_dir: Directory to save to.
            filename: Custom filename. Defaults to track_id.mp3.

        Returns:
            Path to the downloaded file.
        """
        import httpx

        output_dir.mkdir(parents=True, exist_ok=True)
        fname = filename or f"{track.track_id}.mp3"
        dest = output_dir / fname

        if dest.exists():
            track.local_path = dest
            return dest

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(track.audio_url, follow_redirects=True)
            resp.raise_for_status()
            dest.write_bytes(resp.content)

        track.local_path = dest
        return dest
