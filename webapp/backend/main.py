"""FastAPI server for VoxMachina web application.

Provides REST endpoints for audio upload/download/processing and
WebSocket endpoints for real-time audio streaming and parameter updates.
"""

from __future__ import annotations

import io
import json
import tempfile
import uuid
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from voxmachinae.core.audio_io import load_audio
from voxmachinae.core.autotune import AutoTune, AutoTuneParams
from voxmachinae.core.pitch import detect_pitch
from voxmachinae.core.scales import SCALE_INTERVALS, NOTE_NAMES, detect_key
from voxmachinae.core.vocoder import (
    ChannelVocoder,
    ChannelVocoderParams,
    PhaseVocoder,
    PhaseVocoderParams,
    LPCVocoder,
    LPCVocoderParams,
)
from voxmachinae.core.effects import (
    apply_reverb, ReverbParams,
    apply_delay, DelayParams,
    apply_formant_shift, FormantShiftParams,
)
from voxmachinae.core.separation import extract_stem, list_separation_backends, STEM_NAMES
from voxmachinae.core.denoise import (
    reduce_noise, NoiseReduceParams,
    enhance_speech,
    normalize_loudness,
    remove_silence, SilenceParams,
)
from voxmachinae.presets.autotune_presets import AUTOTUNE_PRESETS, get_autotune_preset
from voxmachinae.presets.vocoder_presets import (
    CHANNEL_VOCODER_PRESETS,
    PHASE_VOCODER_PRESETS,
    LPC_VOCODER_PRESETS,
)
from voxmachinae.utils.visualization import (
    get_waveform_data,
    get_spectrogram_data,
    get_pitch_contour_data,
)
from voxmachinae.utils.samples import (
    list_samples,
    load_sample,
    generate_test_samples,
)

from webapp.backend.session import SessionManager, EffectNode

# Lazy imports for optional AI/generative features
_generative_clients: dict = {}
AudioSource = Literal["auto", "original", "processed"]

app = FastAPI(title="VoxMachina", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = SessionManager()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class AutoTuneRequest(BaseModel):
    session_id: str
    source: AudioSource = "auto"
    key: str = "C"
    scale_type: str = "chromatic"
    retune_speed: float = 0.0
    humanize: float = 0.0
    formant_correction: bool = True
    flex_tune: float = 50.0
    transpose: int = 0
    preset: str | None = None


class VocoderRequest(BaseModel):
    session_id: str
    source: AudioSource = "auto"
    vocoder_type: str = "channel"  # "channel", "phase", "lpc"
    preset: str | None = None
    # Channel vocoder params
    n_bands: int = 16
    carrier_type: str = "saw"
    carrier_freq: float = 100.0
    sibilance: float = 0.3
    # Phase vocoder params
    robotize: bool = False
    whisperize: bool = False
    freeze: bool = False
    # Common
    mix: float = 1.0


class EffectRequest(BaseModel):
    session_id: str
    source: AudioSource = "auto"
    effect_type: str  # "reverb", "delay", "formant_shift"
    # Reverb
    room_size: float = 0.5
    damping: float = 0.5
    # Delay
    delay_time: float = 0.3
    feedback: float = 0.4
    # Formant shift
    shift_semitones: float = 0.0
    # Common
    wet: float = 0.3


class GenerateRequest(BaseModel):
    engine: str = "suno"  # "suno", "elevenlabs", "stable_audio"
    prompt: str
    title: str | None = None
    style: str | None = None
    model: str = "v4"
    instrumental: bool = False
    duration_seconds: float = 30.0


class AIChatRequest(BaseModel):
    session_id: str
    agent_mode: str = "coach"  # "coach", "producer", "mixer"
    message: str
    history: list[dict[str, str]] = []


class ChainAddRequest(BaseModel):
    session_id: str
    effect_type: str
    params: dict = {}
    label: str = ""


class ChainReorderRequest(BaseModel):
    session_id: str
    ordered_ids: list[str]


class ChainUpdateRequest(BaseModel):
    session_id: str
    node_id: str
    params: dict | None = None
    enabled: bool | None = None
    label: str | None = None


class SeparateRequest(BaseModel):
    session_id: str
    source: AudioSource = "auto"
    engine: str = "demucs_legacy"
    model: str = "htdemucs"  # "htdemucs", "htdemucs_ft", "mdx_extra"
    stem: str = "vocals"


class DenoiseRequest(BaseModel):
    session_id: str
    source: AudioSource = "auto"
    mode: str = "noise_reduce"  # "noise_reduce", "enhance_speech", "full"
    # Noise reduction params
    stationary: bool = True
    prop_decrease: float = 0.8
    # Loudness normalization
    normalize: bool = False
    target_lufs: float = -14.0
    # Silence removal
    remove_silence_flag: bool = False
    silence_top_db: float = 30.0


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------


def _get_session_audio(session_id: str, source: AudioSource = "auto"):
    """Resolve which buffer to process for a request."""
    if source == "original":
        audio = sessions.get_audio(session_id, "original")
    elif source == "processed":
        audio = sessions.get_audio(session_id, "processed")
        if audio is None:
            raise HTTPException(409, "No processed audio is available for this session yet")
    else:
        audio = sessions.get_audio(session_id, "processed")
        if audio is None:
            audio = sessions.get_audio(session_id, "original")

    if audio is None:
        raise HTTPException(404, "Session not found")
    return audio


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/separation/options")
async def separation_options():
    """List supported separation engines, models, and stems."""
    return {
        "engines": [
            {
                "engine": backend.engine,
                "label": backend.label,
                "description": backend.description,
                "models": list(backend.models),
                "stems": list(backend.stems),
            }
            for backend in list_separation_backends()
        ]
    }


@app.get("/api/scales")
async def list_scales():
    """List all available scales and note names."""
    return {
        "scale_types": list(SCALE_INTERVALS.keys()),
        "note_names": NOTE_NAMES,
    }


@app.get("/api/presets")
async def list_presets():
    """List all available presets."""
    return {
        "autotune": list(AUTOTUNE_PRESETS.keys()),
        "channel_vocoder": list(CHANNEL_VOCODER_PRESETS.keys()),
        "phase_vocoder": list(PHASE_VOCODER_PRESETS.keys()),
        "lpc_vocoder": list(LPC_VOCODER_PRESETS.keys()),
    }


@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file and create a session."""
    session_id = str(uuid.uuid4())

    # Save to temp file, load as AudioBuffer
    suffix = Path(file.filename or "audio.wav").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    audio = load_audio(tmp_path, mono=False)
    sessions.create(session_id, audio)

    # Clean up temp file
    Path(tmp_path).unlink(missing_ok=True)

    return {
        "session_id": session_id,
        "duration": audio.duration,
        "sample_rate": audio.sample_rate,
        "channels": audio.channels,
        "name": file.filename,
    }


@app.get("/api/session/{session_id}/waveform")
async def get_waveform(session_id: str, source: str = "original"):
    """Get waveform visualization data."""
    audio = sessions.get_audio(session_id, source)
    if audio is None:
        raise HTTPException(404, "Session or audio source not found")
    data = get_waveform_data(audio)
    return {
        "times": data.times,
        "amplitudes": data.amplitudes,
        "duration": data.duration,
    }


@app.get("/api/session/{session_id}/spectrogram")
async def get_spectrogram(session_id: str, source: str = "original"):
    """Get spectrogram visualization data."""
    audio = sessions.get_audio(session_id, source)
    if audio is None:
        raise HTTPException(404, "Session or audio source not found")
    data = get_spectrogram_data(audio)
    return {
        "times": data.times,
        "frequencies": data.frequencies,
        "magnitudes": data.magnitudes,
    }


@app.get("/api/session/{session_id}/pitch")
async def get_pitch(session_id: str, method: str = "pyin"):
    """Detect and return pitch contour."""
    audio = sessions.get_audio(session_id, "original")
    if audio is None:
        raise HTTPException(404, "Session not found")

    pitch_track = detect_pitch(audio.mono, audio.sample_rate, method=method)
    contour = get_pitch_contour_data(pitch_track)

    # Also detect key
    key_root, key_type, key_confidence = detect_key(
        pitch_track.frequencies, pitch_track.confidences
    )

    return {
        "times": contour.times,
        "frequencies": contour.frequencies,
        "confidences": contour.confidences,
        "note_names": contour.note_names,
        "detected_key": {
            "root": key_root,
            "type": key_type,
            "confidence": key_confidence,
        },
    }


@app.post("/api/process/autotune")
async def process_autotune(req: AutoTuneRequest):
    """Apply auto-tune effect."""
    audio = _get_session_audio(req.session_id, req.source)

    if req.preset:
        params = get_autotune_preset(req.preset, req.key, req.scale_type)
    else:
        params = AutoTuneParams(
            key=req.key,
            scale_type=req.scale_type,
            retune_speed=req.retune_speed,
            humanize=req.humanize,
            formant_correction=req.formant_correction,
            flex_tune=req.flex_tune,
            transpose=req.transpose,
        )

    at = AutoTune(params)
    result = at.process(audio)

    sessions.set_processed(req.session_id, result.audio)

    return {
        "session_id": req.session_id,
        "duration": result.audio.duration,
        "mean_correction_cents": float(np.mean(np.abs(result.correction_amounts[result.correction_amounts != 0])))
        if np.any(result.correction_amounts != 0)
        else 0.0,
    }


@app.post("/api/process/vocoder")
async def process_vocoder(req: VocoderRequest):
    """Apply vocoder effect."""
    audio = _get_session_audio(req.session_id, req.source)

    if req.vocoder_type == "channel":
        if req.preset and req.preset in CHANNEL_VOCODER_PRESETS:
            params = CHANNEL_VOCODER_PRESETS[req.preset]
        else:
            params = ChannelVocoderParams(
                n_bands=req.n_bands,
                carrier_type=req.carrier_type,
                carrier_freq=req.carrier_freq,
                sibilance=req.sibilance,
                mix=req.mix,
            )
        vocoder = ChannelVocoder(params)
        result = vocoder.process(audio)

    elif req.vocoder_type == "phase":
        if req.preset and req.preset in PHASE_VOCODER_PRESETS:
            params = PHASE_VOCODER_PRESETS[req.preset]
        else:
            params = PhaseVocoderParams(
                robotize=req.robotize,
                whisperize=req.whisperize,
                freeze=req.freeze,
                mix=req.mix,
            )
        vocoder = PhaseVocoder(params)
        result = vocoder.process(audio)

    elif req.vocoder_type == "lpc":
        if req.preset and req.preset in LPC_VOCODER_PRESETS:
            params = LPC_VOCODER_PRESETS[req.preset]
        else:
            params = LPCVocoderParams(mix=req.mix)
        vocoder = LPCVocoder(params)
        result = vocoder.process(audio)

    else:
        raise HTTPException(400, f"Unknown vocoder type: {req.vocoder_type}")

    sessions.set_processed(req.session_id, result)

    return {
        "session_id": req.session_id,
        "duration": result.duration,
        "vocoder_type": req.vocoder_type,
    }


@app.post("/api/process/effect")
async def process_effect(req: EffectRequest):
    """Apply an additional effect (reverb, delay, formant shift)."""
    audio = _get_session_audio(req.session_id, req.source)

    if req.effect_type == "reverb":
        result = apply_reverb(audio, ReverbParams(
            room_size=req.room_size, damping=req.damping,
            wet=req.wet, dry=1.0 - req.wet,
        ))
    elif req.effect_type == "delay":
        result = apply_delay(audio, DelayParams(
            delay_time=req.delay_time, feedback=req.feedback,
            wet=req.wet, dry=1.0 - req.wet,
        ))
    elif req.effect_type == "formant_shift":
        result = apply_formant_shift(audio, FormantShiftParams(
            shift_semitones=req.shift_semitones,
        ))
    else:
        raise HTTPException(400, f"Unknown effect type: {req.effect_type}")

    sessions.set_processed(req.session_id, result)

    return {"session_id": req.session_id, "duration": result.duration}


@app.post("/api/process/separate")
async def process_separate(req: SeparateRequest):
    """Separate vocals from the uploaded audio using Demucs."""
    audio = _get_session_audio(req.session_id, req.source)

    if req.stem not in STEM_NAMES:
        raise HTTPException(400, f"Unknown stem: {req.stem}")

    try:
        stem_audio = extract_stem(
            audio,
            stem_name=req.stem,
            engine=req.engine,
            model_name=req.model,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except ImportError as exc:
        raise HTTPException(
            501,
            f"Stem separation is not available: {exc}",
        )

    sessions.set_processed(req.session_id, stem_audio)

    return {
        "session_id": req.session_id,
        "duration": stem_audio.duration,
        "engine": req.engine,
        "model": req.model,
        "stem": req.stem,
    }


@app.post("/api/process/denoise")
async def process_denoise(req: DenoiseRequest):
    """Apply denoising / speech enhancement to session audio."""
    audio = _get_session_audio(req.session_id, req.source)

    result = audio

    try:
        if req.mode == "noise_reduce":
            params = NoiseReduceParams(
                stationary=req.stationary,
                prop_decrease=req.prop_decrease,
            )
            result = reduce_noise(result, params=params)
        elif req.mode == "enhance_speech":
            result = enhance_speech(result)
        elif req.mode == "full":
            # Full pipeline: enhance -> normalize -> trim silence
            result = enhance_speech(result)
        else:
            raise HTTPException(400, f"Unknown denoise mode: {req.mode}")
    except ImportError as exc:
        raise HTTPException(
            501,
            f"Denoising dependency not available: {exc}",
        )

    # Optional post-processing steps
    if req.normalize:
        try:
            result = normalize_loudness(result, target_lufs=req.target_lufs)
        except ImportError as exc:
            raise HTTPException(501, f"Loudness normalization not available: {exc}")

    if req.remove_silence_flag:
        result = remove_silence(
            result,
            params=SilenceParams(top_db=req.silence_top_db),
        )

    sessions.set_processed(req.session_id, result)

    return {
        "session_id": req.session_id,
        "duration": result.duration,
        "mode": req.mode,
    }


# ---------------------------------------------------------------------------
# Effects Chain Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/chain/{session_id}")
async def get_chain(session_id: str):
    """Get the current effects chain for a session."""
    chain = sessions.get_chain(session_id)
    return {"chain": [n.to_dict() for n in chain]}


@app.post("/api/session/{session_id}/reset")
async def reset_processed_audio(session_id: str):
    """Clear processed audio and return the session to its original source."""
    original = sessions.get_audio(session_id, "original")
    if original is None:
        raise HTTPException(404, "Session not found")

    sessions.clear_processed(session_id)
    return {
        "session_id": session_id,
        "duration": original.duration,
        "sample_rate": original.sample_rate,
        "channels": original.channels,
        "source": "original",
    }


@app.post("/api/chain/add")
async def add_to_chain(req: ChainAddRequest):
    """Add an effect to the chain."""
    node = EffectNode(
        id=str(uuid.uuid4())[:8],
        effect_type=req.effect_type,
        params=req.params,
        label=req.label,
    )
    chain = sessions.add_effect(req.session_id, node)
    return {"chain": [n.to_dict() for n in chain]}


@app.post("/api/chain/reorder")
async def reorder_chain(req: ChainReorderRequest):
    """Reorder the effects chain."""
    chain = sessions.reorder_chain(req.session_id, req.ordered_ids)
    return {"chain": [n.to_dict() for n in chain]}


@app.post("/api/chain/update")
async def update_chain_node(req: ChainUpdateRequest):
    """Update a single effect node's params or enabled state."""
    kwargs = {}
    if req.params is not None:
        kwargs["params"] = req.params
    if req.enabled is not None:
        kwargs["enabled"] = req.enabled
    if req.label is not None:
        kwargs["label"] = req.label

    node = sessions.update_effect(req.session_id, req.node_id, **kwargs)
    if node is None:
        raise HTTPException(404, "Effect node not found")

    chain = sessions.get_chain(req.session_id)
    return {"chain": [n.to_dict() for n in chain]}


@app.delete("/api/chain/{session_id}/{node_id}")
async def remove_from_chain(session_id: str, node_id: str):
    """Remove an effect from the chain."""
    chain = sessions.remove_effect(session_id, node_id)
    return {"chain": [n.to_dict() for n in chain]}


@app.post("/api/chain/run/{session_id}")
async def run_chain(session_id: str):
    """Run the full effects chain on the original audio in order."""
    original = sessions.get_audio(session_id, "original")
    if original is None:
        raise HTTPException(404, "Session not found")

    chain = sessions.get_chain(session_id)
    enabled = [n for n in chain if n.enabled]

    if not enabled:
        return {
            "session_id": session_id,
            "ok": True,
            "effects_attempted": 0,
            "effects_succeeded": 0,
            "effects_failed": 0,
            "results": [],
            "duration": original.duration,
        }

    result = original
    node_results: list[dict[str, str | bool]] = []
    success_count = 0
    failure_count = 0

    for node in enabled:
        try:
            handled = True
            if node.effect_type == "autotune":
                p = node.params
                params = AutoTuneParams(
                    key=p.get("key", "C"),
                    scale_type=p.get("scale_type", "chromatic"),
                    retune_speed=p.get("retune_speed", 0.0),
                    humanize=p.get("humanize", 0.0),
                    formant_correction=p.get("formant_correction", True),
                    flex_tune=p.get("flex_tune", 50.0),
                    transpose=p.get("transpose", 0),
                )
                at = AutoTune(params)
                at_result = at.process(result)
                result = at_result.audio

            elif node.effect_type == "vocoder":
                p = node.params
                vtype = p.get("vocoder_type", "channel")
                if vtype == "channel":
                    vp = ChannelVocoderParams(
                        n_bands=p.get("n_bands", 16),
                        carrier_type=p.get("carrier_type", "saw"),
                        carrier_freq=p.get("carrier_freq", 100.0),
                        sibilance=p.get("sibilance", 0.3),
                        mix=p.get("mix", 1.0),
                    )
                    result = ChannelVocoder(vp).process(result)
                elif vtype == "phase":
                    vp = PhaseVocoderParams(
                        robotize=p.get("robotize", False),
                        whisperize=p.get("whisperize", False),
                        freeze=p.get("freeze", False),
                        mix=p.get("mix", 1.0),
                    )
                    result = PhaseVocoder(vp).process(result)
                else:
                    vp = LPCVocoderParams(mix=p.get("mix", 1.0))
                    result = LPCVocoder(vp).process(result)

            elif node.effect_type == "reverb":
                p = node.params
                result = apply_reverb(result, ReverbParams(
                    room_size=p.get("room_size", 0.5),
                    damping=p.get("damping", 0.5),
                    wet=p.get("wet", 0.3),
                    dry=1.0 - p.get("wet", 0.3),
                ))

            elif node.effect_type == "delay":
                p = node.params
                result = apply_delay(result, DelayParams(
                    delay_time=p.get("delay_time", 0.3),
                    feedback=p.get("feedback", 0.4),
                    wet=p.get("wet", 0.3),
                    dry=1.0 - p.get("wet", 0.3),
                ))

            elif node.effect_type == "formant":
                p = node.params
                result = apply_formant_shift(result, FormantShiftParams(
                    shift_semitones=p.get("shift_semitones", 0.0),
                ))

            elif node.effect_type == "denoise":
                p = node.params
                mode = p.get("mode", "noise_reduce")
                if mode == "enhance_speech":
                    result = enhance_speech(result)
                else:
                    result = reduce_noise(result, params=NoiseReduceParams(
                        stationary=p.get("stationary", True),
                        prop_decrease=p.get("prop_decrease", 0.8),
                    ))
            else:
                handled = False

            if not handled:
                raise ValueError(f"Unknown effect type: {node.effect_type}")

            success_count += 1
            node_results.append({
                "id": node.id,
                "effect_type": node.effect_type,
                "ok": True,
                "message": "",
            })

        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                f"Effect {node.effect_type} (id={node.id}) failed: {exc}"
            )
            failure_count += 1
            node_results.append({
                "id": node.id,
                "effect_type": node.effect_type,
                "ok": False,
                "message": str(exc),
            })
            continue

    if success_count > 0:
        sessions.set_processed(session_id, result)

    return {
        "session_id": session_id,
        "ok": failure_count == 0,
        "effects_attempted": len(enabled),
        "effects_succeeded": success_count,
        "effects_failed": failure_count,
        "results": node_results,
        "duration": result.duration if success_count > 0 else original.duration,
    }


# ---------------------------------------------------------------------------
# Sample Library Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/samples")
async def api_list_samples(category: str | None = None):
    """List all available samples, optionally filtered by category."""
    samples = list_samples(category=category)
    return {
        "samples": [
            {
                "name": s.name,
                "filename": s.filename,
                "description": s.description,
                "category": s.category,
                "duration": s.duration,
                "sample_rate": s.sample_rate,
                "tags": s.tags,
            }
            for s in samples
        ],
    }


@app.post("/api/samples/load")
async def api_load_sample(name: str, sr: int | None = None):
    """Load a sample from the library into a new session."""
    try:
        audio = load_sample(name, sr=sr, mono=False)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))

    session_id = str(uuid.uuid4())
    sessions.create(session_id, audio)

    return {
        "session_id": session_id,
        "name": name,
        "duration": audio.duration,
        "sample_rate": audio.sample_rate,
        "channels": audio.channels,
    }


@app.post("/api/samples/generate-test")
async def api_generate_test_samples():
    """Generate synthetic test samples for development/testing."""
    paths = generate_test_samples()
    return {
        "generated": [p.name for p in paths],
        "count": len(paths),
    }


# ---------------------------------------------------------------------------
# Generative Music Endpoints
# ---------------------------------------------------------------------------


def _get_generative_client(engine: str):
    """Lazy-load and cache generative API clients."""
    import os
    from dotenv import load_dotenv

    # Load .env.local from project root
    project_root = Path(__file__).resolve().parent.parent.parent
    load_dotenv(project_root / ".env.local")

    if engine not in _generative_clients:
        if engine == "suno":
            from voxmachinae.ai.generative.kie_suno import create_client
            _generative_clients[engine] = create_client(
                api_key=os.environ.get("KIE_API_KEY"),
            )
        elif engine == "elevenlabs":
            from voxmachinae.ai.generative.elevenlabs_music import create_client
            _generative_clients[engine] = create_client(
                api_key=os.environ.get("ELEVENLABS_API_KEY"),
            )
        elif engine == "stable_audio":
            from voxmachinae.ai.generative.stable_audio import create_client
            _generative_clients[engine] = create_client(
                api_key=os.environ.get("STABILITY_API_KEY"),
            )
        else:
            raise ValueError(f"Unknown engine: {engine}")

    return _generative_clients[engine]


# In-memory generation task storage
_generation_tasks: dict[str, dict] = {}


@app.post("/api/generate")
async def generate_music(req: GenerateRequest):
    """Submit a music generation request."""
    from voxmachinae.ai.generative.base import GenerationRequest

    try:
        client = _get_generative_client(req.engine)
    except (ValueError, ImportError) as exc:
        raise HTTPException(400, str(exc))

    gen_req = GenerationRequest(
        prompt=req.prompt,
        title=req.title or "",
        style=req.style or "",
        model=req.model,
        instrumental=req.instrumental,
        custom_mode=bool(req.style or req.title),
        duration_seconds=req.duration_seconds,
    )

    try:
        result = await client.generate(gen_req)
    except Exception as exc:
        raise HTTPException(500, f"Generation failed: {exc}")

    # For synchronous engines (Stable Audio, ElevenLabs), result is already done
    if result.status.value == "success":
        _generation_tasks[result.task_id] = {
            "status": "success",
            "tracks": [
                {
                    "track_id": t.track_id,
                    "title": t.title,
                    "duration": t.duration,
                    "model": t.model,
                    "local_path": str(t.local_path) if t.local_path else None,
                    "audio_url": t.audio_url,
                }
                for t in result.tracks
            ],
            "engine": req.engine,
        }
    else:
        # For async engines (Suno), store task for polling
        _generation_tasks[result.task_id] = {
            "status": result.status.value,
            "tracks": [],
            "engine": req.engine,
            "error_message": result.error_message,
        }

    return {
        "task_id": result.task_id,
        "status": result.status.value,
        "tracks": _generation_tasks[result.task_id]["tracks"],
    }


@app.get("/api/generate/status/{task_id}")
async def check_generation_status(task_id: str):
    """Poll the status of a music generation task."""
    task = _generation_tasks.get(task_id)
    if task is None:
        raise HTTPException(404, "Task not found")

    # If already complete, return cached result
    if task["status"] in ("success", "failed"):
        return task

    # Poll the engine
    engine = task.get("engine", "suno")
    try:
        client = _get_generative_client(engine)
        result = await client.poll_status(task_id)

        task["status"] = result.status.value
        if result.tracks:
            task["tracks"] = [
                {
                    "track_id": t.track_id,
                    "title": t.title,
                    "duration": t.duration,
                    "model": t.model,
                    "local_path": str(t.local_path) if t.local_path else None,
                    "audio_url": t.audio_url,
                }
                for t in result.tracks
            ]
        if result.error_message:
            task["error_message"] = result.error_message

    except Exception as exc:
        task["status"] = "failed"
        task["error_message"] = str(exc)

    return task


@app.post("/api/generate/load/{track_id}")
async def load_generated_track(track_id: str):
    """Load a generated track into a session for processing."""
    # Find the track across all tasks
    track_info = None
    for task in _generation_tasks.values():
        for t in task.get("tracks", []):
            if t["track_id"] == track_id:
                track_info = t
                break
        if track_info:
            break

    if track_info is None:
        raise HTTPException(404, "Track not found")

    local_path = track_info.get("local_path")
    audio_url = track_info.get("audio_url")

    if local_path and Path(local_path).exists():
        audio = load_audio(local_path, mono=True)
    elif audio_url:
        # Download from URL
        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(audio_url, follow_redirects=True)
            resp.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        audio = load_audio(tmp_path, mono=True)
        Path(tmp_path).unlink(missing_ok=True)
    else:
        raise HTTPException(400, "No audio available for this track")

    session_id = str(uuid.uuid4())
    sessions.create(session_id, audio)

    return {
        "session_id": session_id,
        "duration": audio.duration,
        "sample_rate": audio.sample_rate,
        "name": track_info.get("title", "Generated Track"),
    }


# ---------------------------------------------------------------------------
# AI Chat Endpoints
# ---------------------------------------------------------------------------


@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest):
    """Send a message to an AI agent and get a response."""
    from voxmachinae.ai.agents.coach import chat, AudioContext

    # Build audio context from session if available
    audio_ctx = AudioContext()
    audio = sessions.get_audio(req.session_id, "original")
    if audio:
        audio_ctx.duration = audio.duration
        audio_ctx.sample_rate = audio.sample_rate

        # Try to detect key
        try:
            pitch_track = detect_pitch(audio.mono, audio.sample_rate)
            key_root, key_type, key_conf = detect_key(
                pitch_track.frequencies, pitch_track.confidences
            )
            audio_ctx.detected_key = key_root
            audio_ctx.detected_scale = key_type
            audio_ctx.pitch_confidence = key_conf
        except Exception:
            pass

    try:
        response = await chat(
            message=req.message,
            agent_mode=req.agent_mode,
            history=req.history or None,
            audio_context=audio_ctx if audio else None,
        )
    except Exception as exc:
        raise HTTPException(500, f"AI agent error: {exc}")

    return {
        "response": response.content,
        "suggestions": response.suggestions,
        "model_used": response.model_used,
    }


@app.get("/api/session/{session_id}/download")
async def download_audio(session_id: str, source: str = "processed", format: str = "wav"):
    """Download processed audio."""
    audio = sessions.get_audio(session_id, source)
    if audio is None:
        raise HTTPException(404, "Audio not found")

    audio_bytes = audio.to_bytes(format=format.upper())
    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type=f"audio/{format}",
        headers={"Content-Disposition": f"attachment; filename=voxmachina_output.{format}"},
    )


# ---------------------------------------------------------------------------
# WebSocket for real-time parameter updates
# ---------------------------------------------------------------------------


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket for real-time audio parameter updates.

    Receives JSON messages with parameter changes,
    re-processes audio, and sends back visualization data.
    """
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "autotune_params":
                # Real-time auto-tune parameter update
                audio = sessions.get_audio(session_id, "original")
                if audio is None:
                    await websocket.send_json({"type": "error", "message": "No audio loaded"})
                    continue

                params = AutoTuneParams(**{
                    k: v for k, v in msg.get("params", {}).items()
                    if k in AutoTuneParams.__dataclass_fields__
                })
                at = AutoTune(params)
                result = at.process(audio)
                sessions.set_processed(session_id, result.audio)

                # Send back waveform data for the processed audio
                waveform = get_waveform_data(result.audio)
                await websocket.send_json({
                    "type": "processed_waveform",
                    "times": waveform.times,
                    "amplitudes": waveform.amplitudes,
                    "duration": waveform.duration,
                })

            elif msg_type == "vocoder_params":
                audio = sessions.get_audio(session_id, "original")
                if audio is None:
                    await websocket.send_json({"type": "error", "message": "No audio loaded"})
                    continue

                vtype = msg.get("vocoder_type", "channel")
                vparams = msg.get("params", {})

                if vtype == "channel":
                    vocoder = ChannelVocoder(ChannelVocoderParams(**{
                        k: v for k, v in vparams.items()
                        if k in ChannelVocoderParams.__dataclass_fields__
                    }))
                    result = vocoder.process(audio)
                elif vtype == "phase":
                    vocoder = PhaseVocoder(PhaseVocoderParams(**{
                        k: v for k, v in vparams.items()
                        if k in PhaseVocoderParams.__dataclass_fields__
                    }))
                    result = vocoder.process(audio)
                else:
                    vocoder = LPCVocoder(LPCVocoderParams(**{
                        k: v for k, v in vparams.items()
                        if k in LPCVocoderParams.__dataclass_fields__
                    }))
                    result = vocoder.process(audio)

                sessions.set_processed(session_id, result)

                waveform = get_waveform_data(result)
                await websocket.send_json({
                    "type": "processed_waveform",
                    "times": waveform.times,
                    "amplitudes": waveform.amplitudes,
                    "duration": waveform.duration,
                })

            elif msg_type == "get_audio":
                # Stream processed audio back as base64 WAV
                import base64
                source = msg.get("source", "processed")
                audio = sessions.get_audio(session_id, source)
                if audio is None:
                    await websocket.send_json({"type": "error", "message": "No audio"})
                    continue

                audio_bytes = audio.to_bytes(format="WAV")
                b64 = base64.b64encode(audio_bytes).decode("ascii")
                await websocket.send_json({
                    "type": "audio_data",
                    "source": source,
                    "format": "wav",
                    "data": b64,
                })

    except WebSocketDisconnect:
        pass
