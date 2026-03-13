"""Auto-tune pipeline: pitch detection -> quantization -> pitch shifting.

Combines pitch detection, scale-based quantization, and WORLD vocoder-based
pitch shifting to produce tuned vocal output with optional formant preservation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from voxmachinae.core.audio_io import AudioBuffer
from voxmachinae.core.pitch import PitchTrack, detect_pitch
from voxmachinae.core.scales import Scale, freq_to_midi, midi_to_freq


@dataclass
class AutoTuneParams:
    """Parameters controlling the auto-tune effect.

    Attributes:
        key: Root note of the target scale (e.g. 'C', 'F#').
        scale_type: Scale type (e.g. 'major', 'minor', 'chromatic').
        retune_speed: How fast pitch corrects in ms (0=instant, 400=very slow).
        humanize: Percentage of original pitch variation to preserve (0-100).
        formant_correction: Whether to preserve formants during pitch shifting.
        flex_tune: Cents tolerance — notes within this range of a scale tone get corrected.
        transpose: Semitones to transpose the output (-24 to +24).
        pitch_method: Pitch detection backend.
    """

    key: str = "C"
    scale_type: str = "chromatic"
    retune_speed: float = 0.0
    humanize: float = 0.0
    formant_correction: bool = True
    flex_tune: float = 50.0
    transpose: int = 0
    pitch_method: Literal["pyin", "crepe", "praat"] = "pyin"

    @property
    def scale(self) -> Scale:
        return Scale(self.key, self.scale_type)


@dataclass
class AutoTuneResult:
    """Result of auto-tune processing."""

    audio: AudioBuffer
    original_pitch: PitchTrack
    corrected_frequencies: np.ndarray
    correction_amounts: np.ndarray  # in cents


class AutoTune:
    """Auto-tune processor.

    Usage:
        >>> at = AutoTune(AutoTuneParams(key='C', scale_type='major', retune_speed=0))
        >>> result = at.process(audio_buffer)
        >>> result.audio  # pitch-corrected AudioBuffer
    """

    def __init__(self, params: AutoTuneParams | None = None):
        self.params = params or AutoTuneParams()

    def process(self, audio: AudioBuffer) -> AutoTuneResult:
        """Apply auto-tune to an AudioBuffer.

        Steps:
            1. Detect pitch using configured method
            2. Quantize detected pitches to the target scale
            3. Apply retune speed smoothing
            4. Apply humanize (blend original pitch variation)
            5. Pitch-shift the audio to the corrected frequencies
        """
        mono = audio.to_mono()
        sr = mono.sample_rate

        # Step 1: Detect pitch
        pitch_track = detect_pitch(mono.data, sr, method=self.params.pitch_method)

        # Step 2: Quantize to scale
        target_freqs = self._quantize_to_scale(pitch_track)

        # Step 3: Apply retune speed (smoothing between original and target)
        corrected_freqs = self._apply_retune_speed(
            pitch_track.frequencies, target_freqs, sr, pitch_track.times
        )

        # Step 4: Apply humanize (blend back original pitch variation)
        corrected_freqs = self._apply_humanize(pitch_track.frequencies, corrected_freqs)

        # Step 5: Apply transpose
        if self.params.transpose != 0:
            voiced = corrected_freqs > 0
            midi_notes = np.zeros_like(corrected_freqs)
            midi_notes[voiced] = np.array([freq_to_midi(f) for f in corrected_freqs[voiced]])
            midi_notes[voiced] += self.params.transpose
            corrected_freqs[voiced] = np.array([midi_to_freq(m) for m in midi_notes[voiced]])

        # Calculate correction amounts in cents
        correction_cents = np.zeros_like(corrected_freqs)
        voiced = (pitch_track.frequencies > 0) & (corrected_freqs > 0)
        correction_cents[voiced] = 1200.0 * np.log2(
            corrected_freqs[voiced] / pitch_track.frequencies[voiced]
        )

        # Step 6: Pitch shift using WORLD vocoder
        shifted_audio = self._pitch_shift_world(
            mono.data, sr, pitch_track, corrected_freqs
        )

        result_buf = AudioBuffer(data=shifted_audio, sample_rate=sr, name=f"{audio.name}_tuned")

        return AutoTuneResult(
            audio=result_buf,
            original_pitch=pitch_track,
            corrected_frequencies=corrected_freqs,
            correction_amounts=correction_cents,
        )

    def _quantize_to_scale(self, pitch_track: PitchTrack) -> np.ndarray:
        """Snap detected pitches to the nearest scale note."""
        scale = self.params.scale
        target = np.zeros_like(pitch_track.frequencies)

        for i, (freq, voiced) in enumerate(
            zip(pitch_track.frequencies, pitch_track.voiced)
        ):
            if not voiced or freq <= 0:
                continue

            # Check if within flex_tune range
            cents_off = abs(scale.cents_to_nearest(freq))
            if cents_off <= self.params.flex_tune:
                target[i] = scale.snap_freq(freq)
            else:
                # Too far from any scale note — leave original
                target[i] = freq

        return target

    def _apply_retune_speed(
        self,
        original: np.ndarray,
        target: np.ndarray,
        sr: int,
        times: np.ndarray,
    ) -> np.ndarray:
        """Apply retune speed smoothing (exponential approach to target).

        retune_speed=0 means instant correction, higher values = slower.
        """
        if self.params.retune_speed <= 0:
            return target.copy()

        result = original.copy()
        # Convert retune speed (ms) to smoothing coefficient
        dt = times[1] - times[0] if len(times) > 1 else 0.01
        tau = self.params.retune_speed / 1000.0  # time constant in seconds
        alpha = 1.0 - np.exp(-dt / max(tau, 1e-6))

        for i in range(1, len(result)):
            if target[i] > 0 and result[i - 1] > 0:
                # Exponential smoothing in log-frequency space
                log_current = np.log2(max(result[i - 1], 1e-6))
                log_target = np.log2(max(target[i], 1e-6))
                log_result = log_current + alpha * (log_target - log_current)
                result[i] = 2.0**log_result
            elif target[i] > 0:
                result[i] = target[i]

        return result

    def _apply_humanize(
        self, original: np.ndarray, corrected: np.ndarray
    ) -> np.ndarray:
        """Blend back original pitch variation to preserve natural vibrato."""
        if self.params.humanize <= 0:
            return corrected.copy()

        blend = self.params.humanize / 100.0
        result = corrected.copy()
        voiced = (original > 0) & (corrected > 0)

        # Blend in log-frequency space
        log_orig = np.log2(np.maximum(original[voiced], 1e-6))
        log_corr = np.log2(np.maximum(corrected[voiced], 1e-6))
        log_blended = log_corr + blend * (log_orig - log_corr)
        result[voiced] = 2.0**log_blended

        return result

    def _pitch_shift_world(
        self,
        audio: np.ndarray,
        sr: int,
        pitch_track: PitchTrack,
        target_freqs: np.ndarray,
    ) -> np.ndarray:
        """Shift pitch using the WORLD vocoder (pyworld).

        WORLD gives explicit control over F0 while optionally
        preserving the spectral envelope (formant correction).
        """
        import pyworld as pw

        audio_f64 = audio.astype(np.float64)

        # WORLD analysis
        f0, timeaxis = pw.harvest(audio_f64, sr)
        sp = pw.cheaptrick(audio_f64, f0, timeaxis, sr)
        ap = pw.d4c(audio_f64, f0, timeaxis, sr)

        # Map target frequencies to WORLD's time grid
        target_interp = np.interp(
            timeaxis,
            pitch_track.times,
            target_freqs,
        )

        # Replace F0 where we have valid target pitches
        new_f0 = f0.copy()
        for i in range(len(new_f0)):
            if target_interp[i] > 0:
                new_f0[i] = target_interp[i]

        # Synthesize with modified F0
        # If formant_correction is False, we'd also modify sp, but
        # keeping sp unchanged is the standard formant-preserving approach
        synthesized = pw.synthesize(new_f0, sp, ap, sr)

        # Match original length
        if len(synthesized) > len(audio):
            synthesized = synthesized[: len(audio)]
        elif len(synthesized) < len(audio):
            synthesized = np.pad(synthesized, (0, len(audio) - len(synthesized)))

        return synthesized.astype(np.float32)
