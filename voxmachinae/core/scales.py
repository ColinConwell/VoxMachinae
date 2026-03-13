"""Musical scales, key definitions, and key detection utilities."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Sequence

import numpy as np

# Semitone intervals from root for common scale types
SCALE_INTERVALS: dict[str, tuple[int, ...]] = {
    "chromatic": (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
    "major": (0, 2, 4, 5, 7, 9, 11),
    "minor": (0, 2, 3, 5, 7, 8, 10),
    "harmonic_minor": (0, 2, 3, 5, 7, 8, 11),
    "melodic_minor": (0, 2, 3, 5, 7, 9, 11),
    "dorian": (0, 2, 3, 5, 7, 9, 10),
    "phrygian": (0, 1, 3, 5, 7, 8, 10),
    "lydian": (0, 2, 4, 6, 7, 9, 11),
    "mixolydian": (0, 2, 4, 5, 7, 9, 10),
    "aeolian": (0, 2, 3, 5, 7, 8, 10),
    "locrian": (0, 1, 3, 5, 6, 8, 10),
    "pentatonic_major": (0, 2, 4, 7, 9),
    "pentatonic_minor": (0, 3, 5, 7, 10),
    "blues": (0, 3, 5, 6, 7, 10),
    "whole_tone": (0, 2, 4, 6, 8, 10),
    "diminished": (0, 2, 3, 5, 6, 8, 9, 11),
    "augmented": (0, 3, 4, 7, 8, 11),
}

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NOTE_NAME_TO_PITCH_CLASS = {name: i for i, name in enumerate(NOTE_NAMES)}

# Enharmonic aliases
ENHARMONIC = {
    "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B",
    "E#": "F", "B#": "C",
}

# A4 = 440 Hz reference
A4_FREQ = 440.0
A4_MIDI = 69


def freq_to_midi(freq: float) -> float:
    """Convert frequency (Hz) to MIDI note number (float, may be fractional)."""
    if freq <= 0:
        return 0.0
    return 12.0 * np.log2(freq / A4_FREQ) + A4_MIDI


def midi_to_freq(midi: float) -> float:
    """Convert MIDI note number to frequency (Hz)."""
    return A4_FREQ * 2.0 ** ((midi - A4_MIDI) / 12.0)


def freq_to_note_name(freq: float) -> str:
    """Convert frequency to nearest note name with octave (e.g. 'A4')."""
    midi = round(freq_to_midi(freq))
    octave = (midi // 12) - 1
    note = NOTE_NAMES[midi % 12]
    return f"{note}{octave}"


def parse_note_name(name: str) -> int:
    """Parse a note name like 'C#' or 'Bb' to pitch class (0-11)."""
    name = name.strip()
    # Resolve enharmonic
    if name in ENHARMONIC:
        name = ENHARMONIC[name]
    if name in NOTE_NAME_TO_PITCH_CLASS:
        return NOTE_NAME_TO_PITCH_CLASS[name]
    raise ValueError(f"Unknown note name: {name!r}")


@dataclass(frozen=True)
class Scale:
    """A musical scale defined by a root note and interval pattern.

    Examples:
        >>> scale = Scale("C", "major")
        >>> scale.note_names
        ['C', 'D', 'E', 'F', 'G', 'A', 'B']
        >>> scale.snap_freq(445.0)  # slightly sharp A4
        440.0
    """

    root: str
    scale_type: str = "chromatic"

    def __post_init__(self) -> None:
        if self.scale_type not in SCALE_INTERVALS:
            raise ValueError(
                f"Unknown scale type: {self.scale_type!r}. "
                f"Available: {list(SCALE_INTERVALS.keys())}"
            )

    @property
    def root_pitch_class(self) -> int:
        return parse_note_name(self.root)

    @property
    def intervals(self) -> tuple[int, ...]:
        return SCALE_INTERVALS[self.scale_type]

    @property
    def pitch_classes(self) -> list[int]:
        """Pitch classes (0-11) of all notes in this scale."""
        return [(self.root_pitch_class + i) % 12 for i in self.intervals]

    @property
    def note_names(self) -> list[str]:
        """Note names of all notes in this scale."""
        return [NOTE_NAMES[pc] for pc in self.pitch_classes]

    def nearest_scale_midi(self, midi_note: float) -> float:
        """Snap a MIDI note number to the nearest note in this scale.

        Returns the closest MIDI note that belongs to the scale,
        preserving octave information.
        """
        pitch_class = midi_note % 12
        octave_base = (midi_note // 12) * 12

        pcs = np.array(self.pitch_classes, dtype=float)
        # Check current octave and adjacent octaves
        candidates = np.concatenate([pcs + octave_base - 12, pcs + octave_base, pcs + octave_base + 12])
        distances = np.abs(candidates - midi_note)
        return float(candidates[np.argmin(distances)])

    def snap_freq(self, freq: float) -> float:
        """Snap a frequency to the nearest note in this scale.

        Args:
            freq: Input frequency in Hz.

        Returns:
            Frequency of the nearest scale note in Hz.
        """
        if freq <= 0:
            return freq
        midi = freq_to_midi(freq)
        snapped_midi = self.nearest_scale_midi(midi)
        return midi_to_freq(snapped_midi)

    def cents_to_nearest(self, freq: float) -> float:
        """Calculate cents deviation from the nearest scale note."""
        if freq <= 0:
            return 0.0
        midi = freq_to_midi(freq)
        snapped = self.nearest_scale_midi(midi)
        return (midi - snapped) * 100.0

    def contains_freq(self, freq: float, tolerance_cents: float = 50.0) -> bool:
        """Check if a frequency is within tolerance of a scale note."""
        return abs(self.cents_to_nearest(freq)) <= tolerance_cents

    @classmethod
    def from_string(cls, spec: str) -> Scale:
        """Parse 'C major', 'F# minor', 'Bb blues', etc."""
        parts = spec.strip().split(None, 1)
        if len(parts) == 1:
            return cls(root=parts[0])
        return cls(root=parts[0], scale_type=parts[1].replace(" ", "_"))

    def __repr__(self) -> str:
        return f"Scale('{self.root}', '{self.scale_type}')"


def detect_key(
    frequencies: np.ndarray,
    confidences: np.ndarray | None = None,
    method: str = "krumhansl",
) -> tuple[str, str, float]:
    """Estimate the musical key from a sequence of detected pitches.

    Uses the Krumhansl-Schmuckler key-finding algorithm: correlates the
    pitch-class distribution of the audio with major/minor key profiles.

    Args:
        frequencies: Array of detected frequencies in Hz (0 = unvoiced).
        confidences: Optional confidence weights for each frequency.
        method: Key detection algorithm. Currently only 'krumhansl'.

    Returns:
        Tuple of (root_note, scale_type, correlation_score).
        Example: ('C', 'major', 0.85)
    """
    # Krumhansl-Kessler key profiles (normalized)
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    # Build pitch-class histogram from valid frequencies
    valid = frequencies > 0
    if confidences is not None:
        valid &= confidences > 0.3
    freqs = frequencies[valid]
    weights = confidences[valid] if confidences is not None else np.ones_like(freqs)

    if len(freqs) == 0:
        return ("C", "major", 0.0)

    midi_notes = np.array([freq_to_midi(f) for f in freqs])
    pitch_classes = np.round(midi_notes) % 12

    histogram = np.zeros(12)
    for pc, w in zip(pitch_classes.astype(int), weights):
        histogram[pc % 12] += w

    if histogram.sum() == 0:
        return ("C", "major", 0.0)

    histogram /= histogram.sum()

    # Correlate with all 24 key profiles (12 major + 12 minor)
    best_key = "C"
    best_type = "major"
    best_corr = -1.0

    for root in range(12):
        rotated = np.roll(histogram, -root)

        for profile, scale_type in [(major_profile, "major"), (minor_profile, "minor")]:
            norm_profile = profile / profile.sum()
            corr = np.corrcoef(rotated, norm_profile)[0, 1]
            if corr > best_corr:
                best_corr = corr
                best_key = NOTE_NAMES[root]
                best_type = scale_type

    return (best_key, best_type, float(best_corr))
