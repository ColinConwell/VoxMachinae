"""Pitch detection engine with multiple backend support.

Provides a unified interface across pYIN (librosa), CREPE (CNN-based),
and Praat (parselmouth) pitch detection algorithms.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from voxmachinae.core.scales import freq_to_midi, freq_to_note_name


PitchMethod = Literal["pyin", "crepe", "praat"]


@dataclass
class PitchTrack:
    """Result of pitch detection on an audio signal.

    Attributes:
        times: Timestamps in seconds for each pitch estimate.
        frequencies: Detected F0 in Hz (0.0 = unvoiced).
        confidences: Confidence/probability for each estimate (0-1).
        voiced: Boolean mask of voiced frames.
        sample_rate: Sample rate of the source audio.
        method: Detection method used.
    """

    times: np.ndarray
    frequencies: np.ndarray
    confidences: np.ndarray
    voiced: np.ndarray
    sample_rate: int
    method: str

    @property
    def midi_notes(self) -> np.ndarray:
        """Convert frequencies to MIDI note numbers (0 where unvoiced)."""
        result = np.zeros_like(self.frequencies)
        mask = self.frequencies > 0
        result[mask] = np.array([freq_to_midi(f) for f in self.frequencies[mask]])
        return result

    @property
    def note_names(self) -> list[str]:
        """Convert frequencies to note name strings ('' where unvoiced)."""
        return [freq_to_note_name(f) if f > 0 else "" for f in self.frequencies]

    @property
    def duration(self) -> float:
        return float(self.times[-1]) if len(self.times) > 0 else 0.0

    @property
    def mean_pitch(self) -> float:
        """Mean F0 of voiced frames."""
        voiced_freqs = self.frequencies[self.voiced]
        return float(np.mean(voiced_freqs)) if len(voiced_freqs) > 0 else 0.0

    @property
    def pitch_range(self) -> tuple[float, float]:
        """Min and max F0 of voiced frames."""
        voiced_freqs = self.frequencies[self.voiced]
        if len(voiced_freqs) == 0:
            return (0.0, 0.0)
        return (float(np.min(voiced_freqs)), float(np.max(voiced_freqs)))

    def voiced_segments(self, min_duration: float = 0.05) -> list[tuple[float, float]]:
        """Find contiguous voiced segments.

        Args:
            min_duration: Minimum segment duration in seconds.

        Returns:
            List of (start_time, end_time) tuples.
        """
        segments = []
        in_segment = False
        start = 0.0

        dt = self.times[1] - self.times[0] if len(self.times) > 1 else 0.01

        for i, v in enumerate(self.voiced):
            if v and not in_segment:
                start = self.times[i]
                in_segment = True
            elif not v and in_segment:
                end = self.times[i]
                if end - start >= min_duration:
                    segments.append((float(start), float(end)))
                in_segment = False

        if in_segment:
            end = self.times[-1] + dt
            if end - start >= min_duration:
                segments.append((float(start), float(end)))

        return segments

    def __repr__(self) -> str:
        n_voiced = int(self.voiced.sum())
        return (
            f"PitchTrack({self.method}, {self.duration:.2f}s, "
            f"{n_voiced}/{len(self.voiced)} voiced frames)"
        )


def detect_pitch(
    audio: np.ndarray,
    sr: int = 44100,
    method: PitchMethod = "pyin",
    fmin: float = 65.0,
    fmax: float = 2093.0,
    frame_length: int = 2048,
    hop_length: int | None = None,
    **kwargs,
) -> PitchTrack:
    """Detect pitch (F0) in an audio signal.

    Args:
        audio: Mono audio signal as float32 numpy array.
        sr: Sample rate in Hz.
        method: Detection algorithm ('pyin', 'crepe', or 'praat').
        fmin: Minimum detectable frequency in Hz (default: C2).
        fmax: Maximum detectable frequency in Hz (default: C7).
        frame_length: Analysis window size in samples.
        hop_length: Hop size in samples (default: frame_length // 4).
        **kwargs: Additional method-specific parameters.

    Returns:
        PitchTrack with detection results.
    """
    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    if hop_length is None:
        hop_length = frame_length // 4

    if method == "pyin":
        return _detect_pyin(audio, sr, fmin, fmax, frame_length, hop_length)
    elif method == "crepe":
        return _detect_crepe(audio, sr, fmin, fmax, kwargs.get("model_capacity", "small"))
    elif method == "praat":
        return _detect_praat(audio, sr, fmin, fmax, kwargs.get("time_step", None))
    else:
        raise ValueError(f"Unknown pitch detection method: {method!r}")


def _detect_pyin(
    audio: np.ndarray,
    sr: int,
    fmin: float,
    fmax: float,
    frame_length: int,
    hop_length: int,
) -> PitchTrack:
    """Probabilistic YIN pitch detection via librosa."""
    import librosa

    f0, voiced_flag, voiced_prob = librosa.pyin(
        audio,
        fmin=fmin,
        fmax=fmax,
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length,
    )

    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)
    frequencies = np.nan_to_num(f0, nan=0.0).astype(np.float64)
    confidences = np.nan_to_num(voiced_prob, nan=0.0).astype(np.float64)
    voiced = voiced_flag.astype(bool)

    return PitchTrack(
        times=times,
        frequencies=frequencies,
        confidences=confidences,
        voiced=voiced,
        sample_rate=sr,
        method="pyin",
    )


def _detect_crepe(
    audio: np.ndarray,
    sr: int,
    fmin: float,
    fmax: float,
    model_capacity: str = "small",
) -> PitchTrack:
    """CNN-based pitch detection via CREPE (high accuracy, slower)."""
    import crepe

    times, frequencies, confidences, _ = crepe.predict(
        audio,
        sr,
        model_capacity=model_capacity,
        viterbi=True,
    )

    # Mask frequencies outside range
    mask = (frequencies >= fmin) & (frequencies <= fmax) & (confidences > 0.3)
    frequencies = np.where(mask, frequencies, 0.0)
    voiced = mask

    return PitchTrack(
        times=times,
        frequencies=frequencies,
        confidences=confidences,
        voiced=voiced,
        sample_rate=sr,
        method="crepe",
    )


def _detect_praat(
    audio: np.ndarray,
    sr: int,
    fmin: float,
    fmax: float,
    time_step: float | None = None,
) -> PitchTrack:
    """Pitch detection via Praat (parselmouth). Fast, classic algorithm."""
    import parselmouth

    snd = parselmouth.Sound(audio, sampling_frequency=sr)
    pitch_obj = snd.to_pitch_ac(
        pitch_floor=fmin,
        pitch_ceiling=fmax,
        time_step=time_step or 0.01,
    )

    times = pitch_obj.xs()
    frequencies = np.array([pitch_obj.get_value_at_time(t) for t in times])
    frequencies = np.nan_to_num(frequencies, nan=0.0)

    # Praat doesn't give confidence directly; use strength
    strengths = np.array(
        [pitch_obj.get_strength_at_time(t) for t in times]
    )
    strengths = np.nan_to_num(strengths, nan=0.0)

    voiced = frequencies > 0

    return PitchTrack(
        times=np.array(times),
        frequencies=frequencies,
        confidences=strengths,
        voiced=voiced,
        sample_rate=sr,
        method="praat",
    )
