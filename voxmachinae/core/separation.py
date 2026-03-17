"""Stem separation using Meta's Demucs library.

Separates audio into stems (vocals, drums, bass, other) using
pretrained Demucs models. Requires the ``demucs`` package::

    pip install demucs

Model tiers:
    - ``htdemucs``    : fast hybrid transformer (default)
    - ``htdemucs_ft`` : fine-tuned hybrid transformer (best quality)
    - ``mdx_extra``   : MDX-Net architecture (alternative)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from voxmachinae.core.audio_io import AudioBuffer

# Demucs stem names in standard order
STEM_NAMES = ("drums", "bass", "other", "vocals")

StemName = Literal["drums", "bass", "other", "vocals"]
SeparationEngineName = Literal["demucs_legacy"]
ModelName = Literal["htdemucs", "htdemucs_ft", "mdx_extra"]


@dataclass(frozen=True)
class SeparationBackend:
    """Metadata describing an available source-separation backend."""

    engine: SeparationEngineName
    label: str
    description: str
    models: tuple[ModelName, ...]
    stems: tuple[StemName, ...] = STEM_NAMES


DEMUX_LEGACY_BACKEND = SeparationBackend(
    engine="demucs_legacy",
    label="Demucs Legacy",
    description=(
        "Archived Demucs backend kept for compatibility. Good for quick 4-stem separation, "
        "but the API is structured so newer engines can be added."
    ),
    models=("htdemucs", "htdemucs_ft", "mdx_extra"),
)


@dataclass
class SeparationResult:
    """Container for separated audio stems.

    Each stem is an :class:`AudioBuffer` at the same sample rate
    as the input.
    """

    vocals: AudioBuffer
    drums: AudioBuffer
    bass: AudioBuffer
    other: AudioBuffer
    sample_rate: int

    def stem(self, name: str) -> AudioBuffer:
        """Access a stem by name string."""
        if name not in STEM_NAMES:
            raise ValueError(f"Unknown stem '{name}'. Choose from {STEM_NAMES}")
        return getattr(self, name)


def _ensure_demucs() -> None:
    """Raise a helpful error if demucs is not installed."""
    try:
        import demucs  # noqa: F401
    except ImportError:
        raise ImportError(
            "Demucs is required for stem separation but is not installed.\n"
            "Install it with:  pip install 'voxmachinae[audio-ml]'\n"
            "Or directly:      pip install demucs"
        )


def _to_stereo(audio: AudioBuffer) -> AudioBuffer:
    """Ensure audio is stereo (demucs requires 2-channel input)."""
    if audio.channels == 2:
        return audio
    # Mono -> duplicate to stereo
    stereo_data = np.stack([audio.data, audio.data], axis=-1)
    return AudioBuffer(data=stereo_data, sample_rate=audio.sample_rate, name=audio.name)


def list_separation_backends() -> tuple[SeparationBackend, ...]:
    """Return the currently supported separation backends."""
    return (DEMUX_LEGACY_BACKEND,)


def separate_stems(
    audio: AudioBuffer,
    engine: SeparationEngineName = "demucs_legacy",
    model_name: ModelName = "htdemucs",
    device: str | None = None,
    shifts: int = 1,
    overlap: float = 0.25,
) -> SeparationResult:
    """Separate an AudioBuffer into individual stems.

    Args:
        audio: Input audio (mono or stereo, any sample rate).
        model_name: Demucs model variant to use.
        device: Torch device (``"cpu"``, ``"cuda"``, etc.).
            *None* auto-selects.
        shifts: Number of random shifts for prediction averaging.
            Higher = better quality but slower. 1 is fastest.
        overlap: Overlap between chunks (0.0 - 1.0).

    Returns:
        :class:`SeparationResult` with *vocals*, *drums*, *bass*, *other*.
    """
    if engine != "demucs_legacy":
        raise ValueError(f"Unknown separation engine: {engine!r}")

    _ensure_demucs()

    import torch
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    # Load pretrained model
    model = get_model(model_name)
    model.to(device)

    # Demucs expects stereo at the model's native sample rate
    stereo = _to_stereo(audio)

    # Resample to model's native sample rate if needed
    # Note: AudioBuffer.resample() converts to mono, so we resample
    # each channel independently to preserve stereo layout.
    model_sr = model.samplerate
    if stereo.sample_rate != model_sr:
        import librosa

        stereo_data = stereo.data  # (samples, 2)
        ch0 = librosa.resample(stereo_data[:, 0], orig_sr=stereo.sample_rate, target_sr=model_sr)
        ch1 = librosa.resample(stereo_data[:, 1], orig_sr=stereo.sample_rate, target_sr=model_sr)
        stereo = AudioBuffer(
            data=np.stack([ch0, ch1], axis=-1),
            sample_rate=model_sr,
            name=stereo.name,
        )

    # Convert to torch tensor: (batch, channels, samples)
    # stereo.data is (samples, 2), .T gives (2, samples), unsqueeze(0) gives (1, 2, samples)
    waveform = torch.tensor(stereo.data.T, dtype=torch.float32).unsqueeze(0).to(device)

    # Run separation
    with torch.no_grad():
        sources = apply_model(
            model,
            waveform,
            shifts=shifts,
            overlap=overlap,
        )

    # sources shape: (batch, n_sources, channels, samples)
    sources = sources.squeeze(0).cpu().numpy()  # (n_sources, channels, samples)

    # Build AudioBuffers for each stem
    # If original was mono, mix down separated stems to mono as well
    stems = {}
    for i, name in enumerate(model.sources):
        stem_data = sources[i]  # (channels, samples) -> need (samples, channels)
        stem_data = stem_data.T  # (samples, channels)

        if audio.channels == 1:
            # Mix to mono
            stem_data = stem_data.mean(axis=1)

        stems[name] = AudioBuffer(
            data=stem_data,
            sample_rate=model_sr,
            name=f"{audio.name}_{name}",
        )

        # Resample back to original sample rate if needed
        if model_sr != audio.sample_rate:
            stems[name] = stems[name].resample(audio.sample_rate)

    return SeparationResult(
        vocals=stems.get("vocals", _silent_buffer(audio)),
        drums=stems.get("drums", _silent_buffer(audio)),
        bass=stems.get("bass", _silent_buffer(audio)),
        other=stems.get("other", _silent_buffer(audio)),
        sample_rate=audio.sample_rate,
    )


def extract_stem(
    audio: AudioBuffer,
    stem_name: StemName = "vocals",
    engine: SeparationEngineName = "demucs_legacy",
    model_name: ModelName = "htdemucs",
    device: str | None = None,
) -> AudioBuffer:
    """Extract a single stem from audio.

    Convenience wrapper around :func:`separate_stems` that returns
    the selected stem.

    Args:
        audio: Input audio.
        stem_name: Name of the stem to extract.
        engine: Separation backend.
        model_name: Demucs model variant.
        device: Torch device or *None* for auto-select.

    Returns:
        AudioBuffer containing the isolated stem.
    """
    result = separate_stems(audio, engine=engine, model_name=model_name, device=device)
    return result.stem(stem_name)


def extract_vocals(
    audio: AudioBuffer,
    engine: SeparationEngineName = "demucs_legacy",
    model_name: ModelName = "htdemucs",
    device: str | None = None,
) -> AudioBuffer:
    """Extract only the vocal track from audio."""
    return extract_stem(
        audio,
        stem_name="vocals",
        engine=engine,
        model_name=model_name,
        device=device,
    )


def _silent_buffer(reference: AudioBuffer) -> AudioBuffer:
    """Create a silent AudioBuffer matching a reference buffer's shape."""
    return AudioBuffer(
        data=np.zeros_like(reference.data),
        sample_rate=reference.sample_rate,
        name=f"{reference.name}_silent",
    )
