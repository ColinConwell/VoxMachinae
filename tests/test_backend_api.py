from __future__ import annotations

from io import BytesIO

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from voxmachinae.core.audio_io import AudioBuffer
from voxmachinae.ai.agents.coach import AgentResponse
from webapp.backend import main
from webapp.backend.session import EffectNode


client = TestClient(main.app)


def _clear_sessions() -> None:
    for session_id in list(main.sessions.list_sessions()):
        main.sessions.delete(session_id)


def _make_audio(name: str, channels: int = 1) -> AudioBuffer:
    samples = np.linspace(-0.25, 0.25, 4096, dtype=np.float32)
    if channels == 1:
        data = samples
    else:
        data = np.stack([samples, samples[::-1]], axis=-1)
    return AudioBuffer(data=data, sample_rate=44_100, name=name)


def setup_function() -> None:
    _clear_sessions()


def teardown_function() -> None:
    _clear_sessions()


def test_upload_preserves_stereo_channels() -> None:
    left = np.sin(np.linspace(0, np.pi * 4, 4096, dtype=np.float32))
    right = np.cos(np.linspace(0, np.pi * 4, 4096, dtype=np.float32))
    stereo = np.stack([left, right], axis=-1)

    buffer = BytesIO()
    sf.write(buffer, stereo, 44_100, format="WAV")
    buffer.seek(0)

    response = client.post(
        "/api/upload",
        files={"file": ("stereo.wav", buffer.read(), "audio/wav")},
    )

    assert response.status_code == 200
    payload = response.json()
    session_audio = main.sessions.get_audio(payload["session_id"], "original")

    assert payload["channels"] == 2
    assert session_audio is not None
    assert session_audio.channels == 2


def test_process_autotune_prefers_processed_audio(monkeypatch) -> None:
    session_id = "session-autotune"
    main.sessions.create(session_id, _make_audio("original"))
    main.sessions.set_processed(session_id, _make_audio("processed"))

    def fake_process(self, audio: AudioBuffer):
        return type(
            "AutoTuneResult",
            (),
            {"audio": audio, "correction_amounts": np.zeros(8, dtype=np.float32)},
        )()

    monkeypatch.setattr(main.AutoTune, "process", fake_process)

    response = client.post("/api/process/autotune", json={"session_id": session_id})

    assert response.status_code == 200
    assert main.sessions.get_audio(session_id, "processed").name == "processed"


def test_process_vocoder_can_target_original_source(monkeypatch) -> None:
    session_id = "session-vocoder"
    main.sessions.create(session_id, _make_audio("original"))
    main.sessions.set_processed(session_id, _make_audio("processed"))

    def fake_process(self, audio: AudioBuffer) -> AudioBuffer:
        return audio

    monkeypatch.setattr(main.ChannelVocoder, "process", fake_process)

    response = client.post(
        "/api/process/vocoder",
        json={"session_id": session_id, "source": "original", "vocoder_type": "channel"},
    )

    assert response.status_code == 200
    assert main.sessions.get_audio(session_id, "processed").name == "original"


def test_chain_run_reports_partial_failures(monkeypatch) -> None:
    session_id = "session-chain"
    original = _make_audio("original")
    main.sessions.create(session_id, original)
    main.sessions.set_chain(
        session_id,
        [
            EffectNode(id="bad-reverb", effect_type="reverb", params={"wet": 0.25}),
            EffectNode(id="good-delay", effect_type="delay", params={"wet": 0.25}),
        ],
    )

    def fail_reverb(audio: AudioBuffer, params):
        raise RuntimeError("reverb exploded")

    def pass_delay(audio: AudioBuffer, params):
        return AudioBuffer(data=audio.data * 0.5, sample_rate=audio.sample_rate, name="delay-out")

    monkeypatch.setattr(main, "apply_reverb", fail_reverb)
    monkeypatch.setattr(main, "apply_delay", pass_delay)

    response = client.post(f"/api/chain/run/{session_id}")

    assert response.status_code == 200
    payload = response.json()

    assert payload["ok"] is False
    assert payload["effects_attempted"] == 2
    assert payload["effects_succeeded"] == 1
    assert payload["effects_failed"] == 1
    assert payload["results"][0]["ok"] is False
    assert payload["results"][1]["ok"] is True
    assert main.sessions.get_audio(session_id, "processed").name == "delay-out"


def test_reset_endpoint_clears_processed_audio() -> None:
    session_id = "session-reset"
    original = _make_audio("original", channels=2)
    main.sessions.create(session_id, original)
    main.sessions.set_processed(session_id, _make_audio("processed"))

    response = client.post(f"/api/session/{session_id}/reset")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "original"
    assert payload["channels"] == 2
    assert main.sessions.get_audio(session_id, "processed") is None


def test_separation_options_endpoint_exposes_legacy_backend() -> None:
    response = client.get("/api/separation/options")

    assert response.status_code == 200
    payload = response.json()
    assert payload["engines"][0]["engine"] == "demucs_legacy"
    assert "vocals" in payload["engines"][0]["stems"]


def test_ai_chat_requires_valid_session() -> None:
    response = client.post(
        "/api/ai/chat",
        json={"session_id": "missing-session", "agent_mode": "coach", "message": "hello"},
    )
    assert response.status_code == 404


def test_ai_chat_includes_active_effects_context(monkeypatch) -> None:
    session_id = "session-ai"
    main.sessions.create(session_id, _make_audio("original"))
    main.sessions.set_chain(
        session_id,
        [
            EffectNode(id="at-1", effect_type="autotune", enabled=True),
            EffectNode(id="rv-1", effect_type="reverb", enabled=False),
            EffectNode(id="dy-1", effect_type="delay", enabled=True),
        ],
    )

    captured: dict[str, object] = {}

    async def fake_chat(*, message, agent_mode, history, audio_context):  # type: ignore[no-untyped-def]
        captured["effects"] = list(audio_context.active_effects)
        return AgentResponse(content="ok", suggestions=[], model_used="test")

    monkeypatch.setattr("voxmachinae.ai.agents.coach.chat", fake_chat)
    response = client.post(
        "/api/ai/chat",
        json={"session_id": session_id, "agent_mode": "mixer", "message": "analyze this"},
    )
    assert response.status_code == 200
    assert captured["effects"] == ["autotune", "delay"]
