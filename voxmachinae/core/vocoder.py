"""Vocoder engine: channel vocoder, phase vocoder, and LPC vocoder.

Implements multiple vocoder architectures for voice synthesis and transformation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy import signal as sig

from voxmachinae.core.audio_io import AudioBuffer
from voxmachinae.synthesis.oscillators import generate_waveform, WaveformType


# ---------------------------------------------------------------------------
# Channel Vocoder
# ---------------------------------------------------------------------------


@dataclass
class ChannelVocoderParams:
    """Parameters for the channel (filter bank) vocoder.

    Attributes:
        n_bands: Number of frequency bands (8-64).
        band_spacing: Linear or logarithmic band spacing.
        carrier_type: Waveform type for the carrier signal.
        carrier_freq: Base frequency of the carrier (Hz). If None, uses 100 Hz.
        envelope_attack: Envelope follower attack time in ms.
        envelope_release: Envelope follower release time in ms.
        sibilance: Amount of high-frequency noise injection (0-1) for intelligibility.
        mix: Dry/wet mix (0=dry, 1=fully vocoded).
    """

    n_bands: int = 16
    band_spacing: Literal["linear", "log"] = "log"
    carrier_type: WaveformType = "saw"
    carrier_freq: float = 100.0
    envelope_attack: float = 5.0
    envelope_release: float = 20.0
    sibilance: float = 0.3
    mix: float = 1.0


class ChannelVocoder:
    """Classic channel vocoder using a filter bank with envelope followers.

    The modulator (voice) signal's spectral envelope is extracted via
    a bank of bandpass filters + envelope followers, then applied to
    a carrier signal (oscillator or external audio).
    """

    def __init__(self, params: ChannelVocoderParams | None = None):
        self.params = params or ChannelVocoderParams()

    def process(
        self,
        modulator: AudioBuffer,
        carrier: AudioBuffer | None = None,
        carrier_freq: float | None = None,
    ) -> AudioBuffer:
        """Apply channel vocoder effect.

        Args:
            modulator: Voice/modulator signal.
            carrier: External carrier signal. If None, generates one.
            carrier_freq: Override carrier frequency.

        Returns:
            Vocoded AudioBuffer.
        """
        sr = modulator.sample_rate
        mod_mono = modulator.to_mono().data
        p = self.params

        # Generate carrier if not provided
        if carrier is not None:
            car_data = carrier.to_mono().data
            # Match length
            if len(car_data) < len(mod_mono):
                reps = int(np.ceil(len(mod_mono) / len(car_data)))
                car_data = np.tile(car_data, reps)[: len(mod_mono)]
            else:
                car_data = car_data[: len(mod_mono)]
        else:
            freq = carrier_freq or p.carrier_freq
            car_data = generate_waveform(
                p.carrier_type, freq, modulator.duration, sr
            )

        # Build filter bank
        bands = self._make_filter_bank(sr)
        output = np.zeros(len(mod_mono), dtype=np.float64)

        for filt_b, filt_a in bands:
            # Filter modulator and carrier through this band
            mod_band = sig.lfilter(filt_b, filt_a, mod_mono)
            car_band = sig.lfilter(filt_b, filt_a, car_data)

            # Extract envelope from modulator band
            envelope = self._envelope_follower(mod_band, sr)

            # Apply envelope to carrier band (clip per-band to prevent overflow)
            band_signal = np.clip(car_band * envelope, -1e6, 1e6)
            output += band_signal

        # Sibilance: inject high-frequency noise for consonant intelligibility
        if p.sibilance > 0:
            sib = self._extract_sibilance(mod_mono, sr)
            output += sib * p.sibilance

        # Normalize
        max_val = np.abs(output).max()
        if max_val > 0:
            output /= max_val

        # Mix dry/wet
        if p.mix < 1.0:
            output = (1.0 - p.mix) * mod_mono + p.mix * output

        return AudioBuffer(
            data=output.astype(np.float32),
            sample_rate=sr,
            name=f"{modulator.name}_vocoded",
        )

    def _make_filter_bank(self, sr: int) -> list[tuple[np.ndarray, np.ndarray]]:
        """Create a bank of bandpass filters."""
        p = self.params
        nyquist = sr / 2.0
        bands = []

        if p.band_spacing == "log":
            # Logarithmic spacing (more bands in lower frequencies)
            freqs = np.geomspace(80, min(nyquist * 0.95, 16000), p.n_bands + 1)
        else:
            freqs = np.linspace(80, min(nyquist * 0.95, 16000), p.n_bands + 1)

        for i in range(p.n_bands):
            low = freqs[i] / nyquist
            high = freqs[i + 1] / nyquist
            # Clamp to valid range
            low = max(low, 0.001)
            high = min(high, 0.999)
            if low >= high:
                continue
            b, a = sig.butter(4, [low, high], btype="bandpass")
            bands.append((b, a))

        return bands

    def _envelope_follower(self, band_signal: np.ndarray, sr: int) -> np.ndarray:
        """Extract amplitude envelope using attack/release smoothing."""
        p = self.params
        rectified = np.abs(band_signal)

        # Convert ms to samples for the smoothing filter
        attack_samples = max(int(p.envelope_attack * sr / 1000), 1)
        release_samples = max(int(p.envelope_release * sr / 1000), 1)

        envelope = np.zeros_like(rectified)
        envelope[0] = rectified[0]

        for i in range(1, len(rectified)):
            if rectified[i] > envelope[i - 1]:
                # Attack
                coeff = 1.0 - np.exp(-1.0 / attack_samples)
            else:
                # Release
                coeff = 1.0 - np.exp(-1.0 / release_samples)
            envelope[i] = envelope[i - 1] + coeff * (rectified[i] - envelope[i - 1])

        return envelope

    def _extract_sibilance(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Extract sibilant/noise content (high-frequency unvoiced sounds)."""
        nyquist = sr / 2.0
        cutoff = min(4000.0, nyquist * 0.8) / nyquist
        b, a = sig.butter(4, cutoff, btype="highpass")
        high = sig.lfilter(b, a, audio)
        envelope = self._envelope_follower(high, sr)
        return high * envelope


# ---------------------------------------------------------------------------
# Phase Vocoder
# ---------------------------------------------------------------------------


@dataclass
class PhaseVocoderParams:
    """Parameters for the phase vocoder (STFT-based cross-synthesis).

    Attributes:
        n_fft: FFT window size.
        hop_length: Hop size between frames.
        robotize: If True, zero out all phases for robotic effect.
        whisperize: If True, randomize phases for whisper effect.
        freeze: If True, freeze spectral content at the current frame.
        mix: Dry/wet mix.
    """

    n_fft: int = 2048
    hop_length: int = 512
    robotize: bool = False
    whisperize: bool = False
    freeze: bool = False
    mix: float = 1.0


class PhaseVocoder:
    """STFT-based phase vocoder for spectral effects."""

    def __init__(self, params: PhaseVocoderParams | None = None):
        self.params = params or PhaseVocoderParams()

    def process(
        self,
        modulator: AudioBuffer,
        carrier: AudioBuffer | None = None,
    ) -> AudioBuffer:
        """Apply phase vocoder effect.

        If carrier is provided, performs cross-synthesis (modulator envelope
        applied to carrier phase). Otherwise applies spectral effects
        (robotize, whisperize, freeze) to the modulator.
        """
        sr = modulator.sample_rate
        mod_mono = modulator.to_mono().data
        p = self.params

        # STFT of modulator
        _, _, mod_stft = sig.stft(mod_mono, sr, nperseg=p.n_fft, noverlap=p.n_fft - p.hop_length)
        mod_mag = np.abs(mod_stft)
        mod_phase = np.angle(mod_stft)

        if carrier is not None:
            car_mono = carrier.to_mono().data
            if len(car_mono) < len(mod_mono):
                reps = int(np.ceil(len(mod_mono) / len(car_mono)))
                car_mono = np.tile(car_mono, reps)[: len(mod_mono)]
            else:
                car_mono = car_mono[: len(mod_mono)]

            _, _, car_stft = sig.stft(car_mono, sr, nperseg=p.n_fft, noverlap=p.n_fft - p.hop_length)
            car_phase = np.angle(car_stft)
            # Cross-synthesis: modulator magnitude + carrier phase
            out_stft = mod_mag * np.exp(1j * car_phase)
        else:
            # Apply spectral effects
            if p.robotize:
                out_stft = mod_mag  # zero phase = robotic monotone
            elif p.whisperize:
                random_phase = np.random.default_rng().uniform(
                    -np.pi, np.pi, mod_phase.shape
                )
                out_stft = mod_mag * np.exp(1j * random_phase)
            elif p.freeze:
                # Freeze at middle frame
                mid = mod_mag.shape[1] // 2
                frozen_mag = np.tile(mod_mag[:, mid : mid + 1], (1, mod_mag.shape[1]))
                out_stft = frozen_mag * np.exp(1j * mod_phase)
            else:
                out_stft = mod_stft

        # Inverse STFT
        _, output = sig.istft(out_stft, sr, nperseg=p.n_fft, noverlap=p.n_fft - p.hop_length)

        # Match original length
        if len(output) > len(mod_mono):
            output = output[: len(mod_mono)]
        elif len(output) < len(mod_mono):
            output = np.pad(output, (0, len(mod_mono) - len(output)))

        # Normalize
        max_val = np.abs(output).max()
        if max_val > 0:
            output /= max_val

        # Mix
        if p.mix < 1.0:
            output = (1.0 - p.mix) * mod_mono + p.mix * output

        return AudioBuffer(
            data=output.astype(np.float32),
            sample_rate=sr,
            name=f"{modulator.name}_phasevoc",
        )


# ---------------------------------------------------------------------------
# LPC Vocoder
# ---------------------------------------------------------------------------


@dataclass
class LPCVocoderParams:
    """Parameters for LPC (Linear Predictive Coding) vocoder.

    Attributes:
        order: LPC filter order (controls spectral resolution).
        frame_size: Analysis frame size in samples.
        hop_size: Hop between frames in samples.
        carrier_type: Excitation signal type.
        mix: Dry/wet mix.
    """

    order: int = 16
    frame_size: int = 1024
    hop_size: int = 256
    carrier_type: WaveformType = "noise"
    mix: float = 1.0


class LPCVocoder:
    """Linear Predictive Coding vocoder for classic robot/radio voice effects."""

    def __init__(self, params: LPCVocoderParams | None = None):
        self.params = params or LPCVocoderParams()

    def process(self, audio: AudioBuffer) -> AudioBuffer:
        """Apply LPC vocoder effect.

        Analyzes the spectral envelope using LPC, then resynthesizes
        with a different excitation signal.
        """
        sr = audio.sample_rate
        mono = audio.to_mono().data
        p = self.params

        n_frames = (len(mono) - p.frame_size) // p.hop_size + 1
        output = np.zeros_like(mono)
        window = sig.windows.hann(p.frame_size)

        # Generate excitation signal
        excitation = generate_waveform(
            p.carrier_type, 100.0, audio.duration + 1.0, sr
        )

        for i in range(n_frames):
            start = i * p.hop_size
            frame = mono[start : start + p.frame_size] * window

            # LPC analysis
            try:
                lpc_coeffs = self._levinson_durbin(frame, p.order)
            except Exception:
                continue

            # Get excitation frame
            exc_frame = excitation[start : start + p.frame_size]
            if len(exc_frame) < p.frame_size:
                exc_frame = np.pad(exc_frame, (0, p.frame_size - len(exc_frame)))

            # LPC synthesis: filter excitation through the LPC filter
            # The LPC filter models the vocal tract
            synthesized = sig.lfilter([1.0], lpc_coeffs, exc_frame) * window

            # Overlap-add
            output[start : start + p.frame_size] += synthesized

        # Normalize
        max_val = np.abs(output).max()
        if max_val > 0:
            output /= max_val

        # Mix
        if p.mix < 1.0:
            output = (1.0 - p.mix) * mono + p.mix * output

        return AudioBuffer(
            data=output.astype(np.float32),
            sample_rate=sr,
            name=f"{audio.name}_lpc",
        )

    def _levinson_durbin(self, frame: np.ndarray, order: int) -> np.ndarray:
        """Compute LPC coefficients using autocorrelation + Levinson-Durbin."""
        # Autocorrelation
        corr = np.correlate(frame, frame, mode="full")
        corr = corr[len(frame) - 1 :]  # Take positive lags

        if corr[0] == 0:
            return np.array([1.0] + [0.0] * order)

        # Levinson-Durbin recursion
        coeffs = np.zeros(order + 1)
        coeffs[0] = 1.0
        error = corr[0]

        for i in range(1, order + 1):
            # Compute reflection coefficient
            acc = sum(coeffs[j] * corr[i - j] for j in range(1, i))
            k = -(corr[i] + acc) / error

            # Update coefficients
            new_coeffs = coeffs.copy()
            for j in range(1, i):
                new_coeffs[j] = coeffs[j] + k * coeffs[i - j]
            new_coeffs[i] = k
            coeffs = new_coeffs

            error *= 1.0 - k * k
            if error <= 0:
                break

        return coeffs
