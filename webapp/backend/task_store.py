"""Persistent generation task storage with TTL support."""

from __future__ import annotations

import json
import time
from pathlib import Path
from threading import Lock
from typing import Any


class GenerationTaskStore:
    """Stores generation task state on disk for restart resilience."""

    def __init__(self, path: Path, ttl_seconds: int = 3600) -> None:
        self.path = path
        self.ttl_seconds = ttl_seconds
        self._lock = Lock()
        self._tasks: dict[str, dict[str, Any]] = {}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._load()
        self.cleanup_expired()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            raw = json.loads(self.path.read_text())
            if isinstance(raw, dict):
                self._tasks = {k: v for k, v in raw.items() if isinstance(v, dict)}
        except (json.JSONDecodeError, OSError):
            self._tasks = {}

    def _save(self) -> None:
        self.path.write_text(json.dumps(self._tasks, indent=2, sort_keys=True))

    def cleanup_expired(self) -> None:
        now = time.time()
        with self._lock:
            expired = [task_id for task_id, task in self._tasks.items() if task.get("expires_at", now + 1) <= now]
            for task_id in expired:
                self._tasks.pop(task_id, None)
            if expired:
                self._save()

    def put(self, task_id: str, payload: dict[str, Any]) -> None:
        now = time.time()
        record = dict(payload)
        record["updated_at"] = now
        record["expires_at"] = now + self.ttl_seconds
        with self._lock:
            self._tasks[task_id] = record
            self._save()

    def get(self, task_id: str) -> dict[str, Any] | None:
        self.cleanup_expired()
        with self._lock:
            task = self._tasks.get(task_id)
            return dict(task) if task else None

    def update(self, task_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        self.cleanup_expired()
        now = time.time()
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            task.update(updates)
            task["updated_at"] = now
            task["expires_at"] = now + self.ttl_seconds
            self._save()
            return dict(task)

    def values(self) -> list[dict[str, Any]]:
        self.cleanup_expired()
        with self._lock:
            return [dict(task) for task in self._tasks.values()]

    def stats(self) -> dict[str, int]:
        self.cleanup_expired()
        with self._lock:
            return {"tasks": len(self._tasks), "ttl_seconds": self.ttl_seconds}
