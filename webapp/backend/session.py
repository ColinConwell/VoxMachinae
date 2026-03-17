"""Session management for audio workspaces."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

from voxmachinae.core.audio_io import AudioBuffer


@dataclass
class EffectNode:
    """A single effect in the processing chain."""

    id: str
    effect_type: str  # "autotune", "vocoder", "reverb", "delay", "formant", "denoise"
    params: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    label: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "effect_type": self.effect_type,
            "params": self.params,
            "enabled": self.enabled,
            "label": self.label or self.effect_type.replace("_", " ").title(),
        }


class SessionManager:
    """Manages per-user audio sessions with original/processed buffers and effect chains."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, AudioBuffer]] = {}
        self._chains: dict[str, list[EffectNode]] = {}

    def create(self, session_id: str, audio: AudioBuffer) -> None:
        self._sessions[session_id] = {"original": audio}
        self._chains[session_id] = []

    def get_audio(self, session_id: str, source: str = "original") -> AudioBuffer | None:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        return session.get(source)

    def set_processed(self, session_id: str, audio: AudioBuffer) -> None:
        session = self._sessions.get(session_id)
        if session is not None:
            session["processed"] = audio

    def clear_processed(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if session is not None:
            session.pop("processed", None)

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        self._chains.pop(session_id, None)

    def list_sessions(self) -> list[str]:
        return list(self._sessions.keys())

    # --- Effect Chain Methods ---

    def get_chain(self, session_id: str) -> list[EffectNode]:
        return self._chains.get(session_id, [])

    def set_chain(self, session_id: str, chain: list[EffectNode]) -> None:
        self._chains[session_id] = chain

    def add_effect(self, session_id: str, node: EffectNode) -> list[EffectNode]:
        chain = self._chains.setdefault(session_id, [])
        chain.append(node)
        return chain

    def remove_effect(self, session_id: str, node_id: str) -> list[EffectNode]:
        chain = self._chains.get(session_id, [])
        self._chains[session_id] = [n for n in chain if n.id != node_id]
        return self._chains[session_id]

    def reorder_chain(self, session_id: str, ordered_ids: list[str]) -> list[EffectNode]:
        chain = self._chains.get(session_id, [])
        by_id = {n.id: n for n in chain}
        reordered = [by_id[nid] for nid in ordered_ids if nid in by_id]
        # Append any nodes not in ordered_ids at the end
        seen = set(ordered_ids)
        for n in chain:
            if n.id not in seen:
                reordered.append(n)
        self._chains[session_id] = reordered
        return reordered

    def update_effect(self, session_id: str, node_id: str, **kwargs: Any) -> EffectNode | None:
        chain = self._chains.get(session_id, [])
        for node in chain:
            if node.id == node_id:
                if "params" in kwargs:
                    node.params.update(kwargs["params"])
                if "enabled" in kwargs:
                    node.enabled = kwargs["enabled"]
                if "label" in kwargs:
                    node.label = kwargs["label"]
                return node
        return None
