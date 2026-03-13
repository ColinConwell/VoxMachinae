"""Additional audio effects: reverb, delay, formant shifting, etc."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal as sig

from voxmachinae.core.audio_io import AudioBuffer


@dataclass
class ReverbParams:
    """Parameters for reverb effect.

    Attributes:
        room_size: Simulated room size factor (0.0 to 1.0).
        damping: High-frequency damping amount (0.0 to 1.0).
        wet: Wet (reverbed) signal level in the output mix.
        dry: Dry (original) signal level in the output mix.
    """

    room_size: float = 0.5
    damping: float = 0.5
    wet: float = 0.3
    dry: float = 0.7


@dataclass
class DelayParams:
    """Parameters for delay/echo effect.

    Attributes:
        delay_time: Delay time in seconds between echoes.
        feedback: Feedback gain controlling echo decay (0.0 to 1.0).
        wet: Wet (delayed) signal level in the output mix.
        dry: Dry (original) signal level in the output mix.
    """

    delay_time: float = 0.3  # seconds
    feedback: float = 0.4
    wet: float = 0.3
    dry: float = 0.7


@dataclass
class FormantShiftParams:
    """Parameters for formant shifting.

    Attributes:
        shift_semitones: Amount to shift formants in semitones. Positive values
            raise formants (smaller vocal tract / chipmunk), negative values
            lower them (larger vocal tract / deep voice).
    """

    shift_semitones: float = 0.0  # positive = higher formants, negative = lower


def apply_reverb(audio: AudioBuffer, params: ReverbParams | None = None) -> AudioBuffer:
    """Simple algorithmic reverb using a feedback delay network."""
    p = params or ReverbParams()
    mono = audio.to_mono().data
    sr = audio.sample_rate

    # Use multiple allpass filters + comb filters for a basic reverb
    delays_ms = [29.7, 37.1, 41.1, 43.7]  # Schroeder reverb delays
    output = np.zeros_like(mono)

    for delay_ms in delays_ms:
        delay_samples = int(delay_ms * sr / 1000 * p.room_size * 3)
        if delay_samples < 1:
            delay_samples = 1

        # Comb filter
        comb = np.zeros(len(mono) + delay_samples)
        comb[: len(mono)] = mono
        fb = p.damping * 0.8
        for i in range(delay_samples, len(comb)):
            comb[i] += fb * comb[i - delay_samples]

        output += comb[: len(mono)] / len(delays_ms)

    result = p.dry * mono + p.wet * output

    # Normalize if needed
    max_val = np.abs(result).max()
    if max_val > 1.0:
        result /= max_val

    return AudioBuffer(data=result.astype(np.float32), sample_rate=sr, name=audio.name)


def apply_delay(audio: AudioBuffer, params: DelayParams | None = None) -> AudioBuffer:
    """Simple delay/echo effect."""
    p = params or DelayParams()
    mono = audio.to_mono().data
    sr = audio.sample_rate

    delay_samples = int(p.delay_time * sr)
    output = np.zeros(len(mono) + delay_samples * 4)
    output[: len(mono)] = mono

    for i in range(1, 5):
        start = i * delay_samples
        gain = p.feedback**i
        if start < len(output):
            end = min(start + len(mono), len(output))
            output[start:end] += mono[: end - start] * gain

    output = output[: len(mono)]
    result = p.dry * mono + p.wet * output

    max_val = np.abs(result).max()
    if max_val > 1.0:
        result /= max_val

    return AudioBuffer(data=result.astype(np.float32), sample_rate=sr, name=audio.name)


def apply_formant_shift(
    audio: AudioBuffer, params: FormantShiftParams | None = None
) -> AudioBuffer:
    """Shift formants without changing pitch using WORLD vocoder.

    Formant shifting changes the perceived vocal tract size:
    positive = smaller (chipmunk), negative = larger (deep).
    """
    p = params or FormantShiftParams()
    if p.shift_semitones == 0:
        return audio

    import pyworld as pw

    mono = audio.to_mono()
    data = mono.data.astype(np.float64)
    sr = mono.sample_rate

    # WORLD analysis
    f0, timeaxis = pw.harvest(data, sr)
    sp = pw.cheaptrick(data, f0, timeaxis, sr)
    ap = pw.d4c(data, f0, timeaxis, sr)

    # Shift spectral envelope (formants) by resampling along frequency axis
    ratio = 2.0 ** (p.shift_semitones / 12.0)
    n_freq = sp.shape[1]
    new_indices = np.arange(n_freq) / ratio
    new_indices = np.clip(new_indices, 0, n_freq - 1)

    shifted_sp = np.zeros_like(sp)
    for i in range(sp.shape[0]):
        shifted_sp[i] = np.interp(np.arange(n_freq), new_indices, sp[i])

    # Synthesize with original F0 but shifted spectral envelope
    synthesized = pw.synthesize(f0, shifted_sp, ap, sr)

    if len(synthesized) > len(data):
        synthesized = synthesized[: len(data)]
    elif len(synthesized) < len(data):
        synthesized = np.pad(synthesized, (0, len(data) - len(synthesized)))

    return AudioBuffer(
        data=synthesized.astype(np.float32),
        sample_rate=sr,
        name=f"{audio.name}_formant",
    )
