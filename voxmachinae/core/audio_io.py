"""Audio I/O: loading, saving, recording, and the AudioBuffer container."""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import numpy as np
import sounddevice as sd
import soundfile as sf


SampleRate = Literal[22050, 44100, 48000]


@dataclass
class AudioBuffer:
    """Container for audio data with metadata.

    Stores audio as a float32 numpy array normalized to [-1, 1].
    Mono audio has shape (n_samples,), stereo has shape (n_samples, 2).
    """

    data: np.ndarray
    sample_rate: int = 44100
    name: str = "untitled"

    def __post_init__(self) -> None:
        self.data = np.asarray(self.data, dtype=np.float32)
        if self.data.ndim == 0:
            raise ValueError("Audio data must be at least 1-dimensional")

    @property
    def channels(self) -> int:
        return 1 if self.data.ndim == 1 else self.data.shape[1]

    @property
    def n_samples(self) -> int:
        return self.data.shape[0]

    @property
    def duration(self) -> float:
        return self.n_samples / self.sample_rate

    @property
    def mono(self) -> np.ndarray:
        """Return mono mix-down (averages channels if stereo)."""
        if self.data.ndim == 1:
            return self.data
        return self.data.mean(axis=1)

    def to_mono(self) -> AudioBuffer:
        """Return a new mono AudioBuffer."""
        return AudioBuffer(data=self.mono, sample_rate=self.sample_rate, name=self.name)

    def resample(self, target_sr: int) -> AudioBuffer:
        """Resample to a different sample rate using librosa."""
        if target_sr == self.sample_rate:
            return self
        import librosa

        resampled = librosa.resample(self.mono, orig_sr=self.sample_rate, target_sr=target_sr)
        return AudioBuffer(data=resampled, sample_rate=target_sr, name=self.name)

    def trim_silence(self, top_db: float = 30.0) -> AudioBuffer:
        """Trim leading/trailing silence."""
        import librosa

        trimmed, _ = librosa.effects.trim(self.mono, top_db=top_db)
        return AudioBuffer(data=trimmed, sample_rate=self.sample_rate, name=self.name)

    def normalize(self, peak: float = 1.0) -> AudioBuffer:
        """Peak-normalize the audio."""
        max_val = np.abs(self.data).max()
        if max_val == 0:
            return self
        normalized = self.data * (peak / max_val)
        return AudioBuffer(data=normalized, sample_rate=self.sample_rate, name=self.name)

    def slice(self, start_sec: float = 0.0, end_sec: float | None = None) -> AudioBuffer:
        """Extract a time slice."""
        start_sample = int(start_sec * self.sample_rate)
        end_sample = int(end_sec * self.sample_rate) if end_sec else self.n_samples
        return AudioBuffer(
            data=self.data[start_sample:end_sample],
            sample_rate=self.sample_rate,
            name=self.name,
        )

    def to_bytes(self, format: str = "WAV") -> bytes:
        """Serialize to bytes in the given format."""
        buf = io.BytesIO()
        sf.write(buf, self.data, self.sample_rate, format=format)
        buf.seek(0)
        return buf.read()

    def __repr__(self) -> str:
        return (
            f"AudioBuffer('{self.name}', {self.duration:.2f}s, "
            f"{self.sample_rate}Hz, {self.channels}ch)"
        )


def load_audio(
    path: str | Path,
    sr: int | None = None,
    mono: bool = True,
) -> AudioBuffer:
    """Load an audio file into an AudioBuffer.

    Args:
        path: Path to audio file (WAV, FLAC, OGG, MP3, WebM, etc.).
        sr: Target sample rate. None keeps original.
        mono: Convert to mono if True.

    Returns:
        AudioBuffer with the loaded audio.
    """
    path = Path(path)

    # Formats that soundfile/libsndfile can't handle (e.g. WebM, MP3 on some systems)
    _LIBROSA_FALLBACK_EXTS = {".webm", ".mp3", ".m4a", ".aac", ".mp4", ".ogg"}

    if path.suffix.lower() in _LIBROSA_FALLBACK_EXTS:
        # Use librosa which delegates to audioread/ffmpeg for broader format support
        import librosa

        target_sr = sr  # librosa resamples for us
        data, file_sr = librosa.load(str(path), sr=target_sr, mono=mono)
        if not mono and data.ndim == 1:
            data = data  # librosa returns mono as 1D
        buf = AudioBuffer(data=data, sample_rate=file_sr, name=path.stem)
        return buf

    # Primary path: use soundfile (fastest, best for WAV/FLAC)
    data, file_sr = sf.read(str(path), dtype="float32", always_2d=True)

    if mono and data.shape[1] > 1:
        data = data.mean(axis=1)
    elif data.shape[1] == 1:
        data = data.squeeze(axis=1)

    buf = AudioBuffer(data=data, sample_rate=file_sr, name=path.stem)

    if sr is not None and sr != file_sr:
        buf = buf.resample(sr)

    return buf


def save_audio(
    buffer: AudioBuffer,
    path: str | Path,
    format: str | None = None,
) -> Path:
    """Save an AudioBuffer to a file.

    Args:
        buffer: Audio data to save.
        path: Output file path.
        format: File format override (e.g. 'WAV', 'FLAC', 'OGG').

    Returns:
        The resolved output path.
    """
    path = Path(path)
    sf.write(str(path), buffer.data, buffer.sample_rate, format=format)
    return path.resolve()


def record_audio(
    duration: float,
    sr: int = 44100,
    channels: int = 1,
    device: int | str | None = None,
) -> AudioBuffer:
    """Record audio from the microphone.

    Args:
        duration: Recording duration in seconds.
        sr: Sample rate.
        channels: Number of channels (1=mono, 2=stereo).
        device: Audio device index or name. None uses default.

    Returns:
        AudioBuffer containing the recorded audio.
    """
    recording = sd.rec(
        int(duration * sr),
        samplerate=sr,
        channels=channels,
        dtype="float32",
        device=device,
    )
    sd.wait()

    data = recording.squeeze() if channels == 1 else recording
    return AudioBuffer(data=data, sample_rate=sr, name="recording")


def list_audio_devices() -> list[dict]:
    """List available audio input/output devices."""
    devices = sd.query_devices()
    return [
        {
            "index": i,
            "name": d["name"],
            "max_input_channels": d["max_input_channels"],
            "max_output_channels": d["max_output_channels"],
            "default_samplerate": d["default_samplerate"],
        }
        for i, d in enumerate(devices)
    ]
