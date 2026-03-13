"""MIDI note and frequency utilities for synthesis."""

from __future__ import annotations

import numpy as np

from voxmachinae.core.scales import (
    A4_FREQ,
    A4_MIDI,
    NOTE_NAMES,
    freq_to_midi,
    midi_to_freq,
)


def note_name_to_midi(name: str) -> int:
    """Convert a note name with octave to MIDI number.

    Examples:
        >>> note_name_to_midi('C4')
        60
        >>> note_name_to_midi('A4')
        69
    """
    # Parse note name and octave
    if len(name) < 2:
        raise ValueError(f"Invalid note name: {name!r}")

    if name[1] == "#" or name[1] == "b":
        note_str = name[:2]
        octave_str = name[2:]
    else:
        note_str = name[0]
        octave_str = name[1:]

    # Handle flats
    flat_to_sharp = {
        "Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#",
        "Ab": "G#", "Bb": "A#", "Cb": "B",
    }
    if note_str in flat_to_sharp:
        note_str = flat_to_sharp[note_str]

    if note_str not in NOTE_NAMES:
        raise ValueError(f"Unknown note: {note_str!r}")

    pitch_class = NOTE_NAMES.index(note_str)
    octave = int(octave_str)
    return (octave + 1) * 12 + pitch_class


def midi_to_note_name(midi: int) -> str:
    """Convert MIDI number to note name with octave.

    Examples:
        >>> midi_to_note_name(60)
        'C4'
        >>> midi_to_note_name(69)
        'A4'
    """
    octave = (midi // 12) - 1
    note = NOTE_NAMES[midi % 12]
    return f"{note}{octave}"


def generate_scale_frequencies(
    root: str,
    scale_intervals: tuple[int, ...],
    octave_start: int = 3,
    octave_end: int = 5,
) -> list[float]:
    """Generate frequencies for all notes in a scale across octaves.

    Args:
        root: Root note name (e.g. 'C', 'F#').
        scale_intervals: Semitone intervals from root.
        octave_start: Lowest octave to include.
        octave_end: Highest octave to include (inclusive).

    Returns:
        Sorted list of frequencies in Hz.
    """
    root_midi = note_name_to_midi(f"{root}{octave_start}")
    freqs = []

    for octave in range(octave_start, octave_end + 1):
        base = note_name_to_midi(f"{root}{octave}")
        for interval in scale_intervals:
            midi = base + interval
            freqs.append(midi_to_freq(midi))

    return sorted(freqs)
