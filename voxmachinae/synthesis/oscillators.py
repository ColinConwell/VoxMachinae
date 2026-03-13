"""Carrier signal oscillators for vocoder synthesis.

Generates basic waveforms (sawtooth, square, sine, noise, pulse)
used as carrier signals in channel vocoder processing.
"""

from __future__ import annotations

from typing import Literal

import numpy as np


WaveformType = Literal["saw", "square", "sine", "triangle", "noise", "pulse"]


def generate_waveform(
    waveform: WaveformType,
    frequency: float | np.ndarray,
    duration: float,
    sr: int = 44100,
    amplitude: float = 1.0,
    duty_cycle: float = 0.5,
) -> np.ndarray:
    """Generate a basic waveform.

    Args:
        waveform: Type of waveform to generate.
        frequency: Frequency in Hz. Can be a scalar or array (for pitch-tracking carrier).
        duration: Duration in seconds.
        sr: Sample rate.
        amplitude: Peak amplitude (0-1).
        duty_cycle: Duty cycle for pulse wave (0-1).

    Returns:
        Audio signal as float32 numpy array.
    """
    n_samples = int(duration * sr)
    t = np.arange(n_samples) / sr

    # Support frequency arrays (pitch-following carrier)
    if isinstance(frequency, np.ndarray):
        # Interpolate frequency array to sample-level
        freq_indices = np.linspace(0, len(frequency) - 1, n_samples)
        freq = np.interp(freq_indices, np.arange(len(frequency)), frequency)
        # Compute instantaneous phase via cumulative integration
        phase = 2.0 * np.pi * np.cumsum(freq / sr)
    else:
        phase = 2.0 * np.pi * frequency * t

    if waveform == "sine":
        signal = np.sin(phase)
    elif waveform == "saw":
        signal = 2.0 * (phase / (2.0 * np.pi) % 1.0) - 1.0
    elif waveform == "square":
        signal = np.sign(np.sin(phase))
    elif waveform == "triangle":
        signal = 2.0 * np.abs(2.0 * (phase / (2.0 * np.pi) % 1.0) - 1.0) - 1.0
    elif waveform == "pulse":
        signal = np.where((phase / (2.0 * np.pi) % 1.0) < duty_cycle, 1.0, -1.0)
    elif waveform == "noise":
        signal = np.random.default_rng().uniform(-1.0, 1.0, n_samples)
    else:
        raise ValueError(f"Unknown waveform type: {waveform!r}")

    return (signal * amplitude).astype(np.float32)


def generate_chord(
    frequencies: list[float],
    duration: float,
    sr: int = 44100,
    waveform: WaveformType = "saw",
    amplitude: float = 0.5,
) -> np.ndarray:
    """Generate a chord by mixing multiple oscillators.

    Args:
        frequencies: List of frequencies for each note in the chord.
        duration: Duration in seconds.
        sr: Sample rate.
        waveform: Waveform type for each oscillator.
        amplitude: Peak amplitude per voice (auto-scaled by voice count).

    Returns:
        Mixed audio signal.
    """
    if not frequencies:
        return np.zeros(int(duration * sr), dtype=np.float32)

    per_voice_amp = amplitude / len(frequencies)
    chord = np.zeros(int(duration * sr), dtype=np.float32)

    for freq in frequencies:
        chord += generate_waveform(waveform, freq, duration, sr, per_voice_amp)

    return chord


def generate_noise(
    duration: float,
    sr: int = 44100,
    color: Literal["white", "pink", "brown"] = "white",
    amplitude: float = 1.0,
) -> np.ndarray:
    """Generate colored noise.

    Args:
        duration: Duration in seconds.
        sr: Sample rate.
        color: Noise color ('white', 'pink', 'brown').
        amplitude: Peak amplitude.

    Returns:
        Noise signal as float32 numpy array.
    """
    n_samples = int(duration * sr)
    rng = np.random.default_rng()

    if color == "white":
        signal = rng.standard_normal(n_samples)
    elif color == "pink":
        # Voss-McCartney approximation for pink noise
        n_rows = 16
        array = rng.standard_normal((n_rows, n_samples))
        # Each row is updated at progressively lower rates
        for i in range(1, n_rows):
            step = 2**i
            for j in range(0, n_samples, step):
                end = min(j + step, n_samples)
                array[i, j:end] = array[i, j]
        signal = array.sum(axis=0)
    elif color == "brown":
        # Brownian noise (integrated white noise)
        white = rng.standard_normal(n_samples)
        signal = np.cumsum(white)
        # High-pass to remove DC drift
        signal -= np.linspace(signal[0], signal[-1], n_samples)
    else:
        raise ValueError(f"Unknown noise color: {color!r}")

    # Normalize to amplitude
    max_val = np.abs(signal).max()
    if max_val > 0:
        signal = signal / max_val * amplitude

    return signal.astype(np.float32)
