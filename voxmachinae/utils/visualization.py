"""Visualization data generators for waveforms, spectrograms, and pitch contours.

Returns data structures (not matplotlib figures) suitable for both
Jupyter notebooks and web frontend rendering.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from voxmachinae.core.audio_io import AudioBuffer
from voxmachinae.core.pitch import PitchTrack


@dataclass
class WaveformData:
    """Downsampled waveform for display."""
    times: list[float]
    amplitudes: list[float]
    sample_rate: int
    duration: float


@dataclass
class SpectrogramData:
    """Spectrogram (STFT magnitude) for display."""
    times: list[float]
    frequencies: list[float]
    magnitudes: list[list[float]]  # 2D: [freq_bin][time_frame]
    sample_rate: int


@dataclass
class PitchContourData:
    """Pitch contour overlay data."""
    times: list[float]
    frequencies: list[float]
    confidences: list[float]
    note_names: list[str]


def get_waveform_data(
    audio: AudioBuffer,
    n_points: int = 2000,
) -> WaveformData:
    """Downsample audio to a displayable waveform.

    Uses peak envelope (min/max per chunk) to preserve transients.
    """
    mono = audio.to_mono().data
    chunk_size = max(1, len(mono) // n_points)
    n_chunks = len(mono) // chunk_size

    times = []
    amplitudes = []

    for i in range(n_chunks):
        chunk = mono[i * chunk_size : (i + 1) * chunk_size]
        t = (i * chunk_size + chunk_size // 2) / audio.sample_rate
        times.append(t)
        # Use RMS for smoother display
        amplitudes.append(float(np.sqrt(np.mean(chunk**2))))

    return WaveformData(
        times=times,
        amplitudes=amplitudes,
        sample_rate=audio.sample_rate,
        duration=audio.duration,
    )


def get_spectrogram_data(
    audio: AudioBuffer,
    n_fft: int = 2048,
    hop_length: int = 512,
    n_mels: int = 128,
) -> SpectrogramData:
    """Compute mel spectrogram for display."""
    import librosa

    mono = audio.to_mono().data
    sr = audio.sample_rate

    S = librosa.feature.melspectrogram(
        y=mono, sr=sr, n_fft=n_fft, hop_length=hop_length, n_mels=n_mels
    )
    S_db = librosa.power_to_db(S, ref=np.max)

    times = librosa.times_like(S_db, sr=sr, hop_length=hop_length).tolist()
    frequencies = librosa.mel_frequencies(n_mels=n_mels, fmax=sr / 2).tolist()

    return SpectrogramData(
        times=times,
        frequencies=frequencies,
        magnitudes=S_db.tolist(),
        sample_rate=sr,
    )


def get_pitch_contour_data(pitch_track: PitchTrack) -> PitchContourData:
    """Extract displayable pitch contour from a PitchTrack."""
    return PitchContourData(
        times=pitch_track.times.tolist(),
        frequencies=pitch_track.frequencies.tolist(),
        confidences=pitch_track.confidences.tolist(),
        note_names=pitch_track.note_names,
    )
