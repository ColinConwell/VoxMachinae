"""Audio cleanup and denoising utilities.

Provides spectral-gating noise reduction, deep-learning speech enhancement,
LUFS loudness normalization, and silence removal.  All functions accept and
return :class:`~voxmachinae.core.audio_io.AudioBuffer` objects.

Optional dependencies:
    - ``noisereduce``  : spectral-gating noise reduction
    - ``df``           : DeepFilterNet speech enhancement
    - ``pyloudnorm``   : LUFS loudness normalization

Install via::

    pip install 'voxmachinae[audio-ml]'
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from voxmachinae.core.audio_io import AudioBuffer


# ---------------------------------------------------------------------------
# Noise reduction (spectral gating)
# ---------------------------------------------------------------------------


@dataclass
class NoiseReduceParams:
    """Parameters for spectral-gating noise reduction.

    Attributes:
        stationary: If *True*, assume stationary noise (faster).
        prop_decrease: Strength of noise reduction (0.0 - 1.0).
            1.0 removes all detected noise, lower values are gentler.
        freq_mask_smooth_hz: Frequency smoothing of the noise mask (Hz).
        time_mask_smooth_ms: Temporal smoothing of the noise mask (ms).
        n_fft: FFT size for STFT.
    """

    stationary: bool = True
    prop_decrease: float = 0.8
    freq_mask_smooth_hz: int = 500
    time_mask_smooth_ms: int = 50
    n_fft: int = 2048


def reduce_noise(
    audio: AudioBuffer,
    params: NoiseReduceParams | None = None,
    noise_clip: AudioBuffer | None = None,
) -> AudioBuffer:
    """Apply spectral-gating noise reduction.

    Args:
        audio: Input audio to denoise.
        params: Noise reduction parameters (uses defaults if *None*).
        noise_clip: Optional AudioBuffer containing a sample of
            *only* noise (e.g., a silent segment).  Improves
            non-stationary noise estimation.

    Returns:
        Denoised AudioBuffer.
    """
    try:
        import noisereduce as nr
    except ImportError:
        raise ImportError(
            "noisereduce is required for noise reduction but is not installed.\n"
            "Install it with:  pip install 'voxmachinae[audio-ml]'\n"
            "Or directly:      pip install noisereduce"
        )

    if params is None:
        params = NoiseReduceParams()

    y_noise = noise_clip.mono if noise_clip is not None else None

    reduced = nr.reduce_noise(
        y=audio.mono,
        sr=audio.sample_rate,
        y_noise=y_noise,
        stationary=params.stationary,
        prop_decrease=params.prop_decrease,
        freq_mask_smooth_hz=params.freq_mask_smooth_hz,
        time_mask_smooth_ms=params.time_mask_smooth_ms,
        n_fft=params.n_fft,
    )

    return AudioBuffer(
        data=reduced.astype(np.float32),
        sample_rate=audio.sample_rate,
        name=f"{audio.name}_denoised",
    )


# ---------------------------------------------------------------------------
# Speech enhancement (DeepFilterNet)
# ---------------------------------------------------------------------------


def _has_deepfilternet() -> bool:
    """Check whether DeepFilterNet is available."""
    try:
        import df  # noqa: F401
        return True
    except ImportError:
        return False


def enhance_speech(
    audio: AudioBuffer,
    use_deepfilter: bool = True,
    fallback_noise_reduce: bool = True,
) -> AudioBuffer:
    """Enhance speech using DeepFilterNet, with fallback to noisereduce.

    DeepFilterNet is a deep-learning model specifically trained for
    speech enhancement.  If it is not installed (or *use_deepfilter* is
    *False*), the function falls back to :func:`reduce_noise` with
    speech-friendly defaults.

    Args:
        audio: Input audio containing speech.
        use_deepfilter: Attempt to use DeepFilterNet if available.
        fallback_noise_reduce: If DeepFilterNet is unavailable and this
            is *True*, fall back to spectral-gating noise reduction.

    Returns:
        Enhanced AudioBuffer.

    Raises:
        ImportError: If neither DeepFilterNet nor noisereduce is available
            and no fallback is allowed.
    """
    if use_deepfilter and _has_deepfilternet():
        return _enhance_with_deepfilter(audio)

    if fallback_noise_reduce:
        # Use speech-friendly noise reduction settings
        speech_params = NoiseReduceParams(
            stationary=False,
            prop_decrease=0.6,
            freq_mask_smooth_hz=200,
            time_mask_smooth_ms=100,
        )
        return reduce_noise(audio, params=speech_params)

    raise ImportError(
        "Speech enhancement requires either DeepFilterNet or noisereduce.\n"
        "Install with:  pip install 'voxmachinae[audio-ml]'"
    )


def _enhance_with_deepfilter(audio: AudioBuffer) -> AudioBuffer:
    """Run DeepFilterNet speech enhancement."""
    from df.enhance import enhance, init_df, load_audio, save_audio as df_save
    import torch

    model, df_state, _ = init_df()

    # DeepFilterNet expects its own sample rate (typically 48 kHz)
    df_sr = df_state.sr()

    # Resample if necessary
    working = audio
    if audio.sample_rate != df_sr:
        working = audio.resample(df_sr)

    # DeepFilterNet expects (channels, samples) torch tensor
    waveform = torch.tensor(working.mono, dtype=torch.float32).unsqueeze(0)

    enhanced = enhance(model, df_state, waveform)

    # Convert back to numpy
    enhanced_np = enhanced.squeeze(0).cpu().numpy()

    result = AudioBuffer(
        data=enhanced_np.astype(np.float32),
        sample_rate=df_sr,
        name=f"{audio.name}_enhanced",
    )

    # Resample back to original rate if needed
    if df_sr != audio.sample_rate:
        result = result.resample(audio.sample_rate)

    return result


# ---------------------------------------------------------------------------
# Loudness normalization (LUFS)
# ---------------------------------------------------------------------------


def normalize_loudness(
    audio: AudioBuffer,
    target_lufs: float = -14.0,
) -> AudioBuffer:
    """Normalize audio loudness to a target LUFS level.

    Uses ITU-R BS.1770-4 loudness measurement via ``pyloudnorm``.

    Common targets:
        - ``-14.0`` : Spotify, YouTube (default)
        - ``-16.0`` : Apple Music / Podcasts
        - ``-23.0`` : EBU R128 broadcast standard

    Args:
        audio: Input audio.
        target_lufs: Target integrated loudness in LUFS.

    Returns:
        Loudness-normalized AudioBuffer.
    """
    try:
        import pyloudnorm as pyln
    except ImportError:
        raise ImportError(
            "pyloudnorm is required for LUFS normalization but is not installed.\n"
            "Install it with:  pip install 'voxmachinae[audio-ml]'\n"
            "Or directly:      pip install pyloudnorm"
        )

    meter = pyln.Meter(audio.sample_rate)

    # pyloudnorm needs at least 0.4s of audio for measurement
    if audio.duration < 0.4:
        # Fall back to simple peak normalization for very short clips
        return audio.normalize()

    # Measure current loudness
    data = audio.data
    if data.ndim == 1:
        # pyloudnorm expects (samples, channels) for multichannel,
        # but also accepts 1D for mono
        pass

    current_lufs = meter.integrated_loudness(data)

    if np.isinf(current_lufs):
        # Silent audio, nothing to normalize
        return audio

    # Apply loudness normalization
    normalized = pyln.normalize.loudness(data, current_lufs, target_lufs)

    # Clip to prevent clipping distortion
    normalized = np.clip(normalized, -1.0, 1.0)

    return AudioBuffer(
        data=normalized.astype(np.float32),
        sample_rate=audio.sample_rate,
        name=f"{audio.name}_normalized",
    )


# ---------------------------------------------------------------------------
# Silence removal / trimming
# ---------------------------------------------------------------------------


@dataclass
class SilenceParams:
    """Parameters for silence detection and removal.

    Attributes:
        top_db: Threshold (in dB below peak) to consider as silence.
        frame_length: Frame length for RMS energy computation (samples).
        hop_length: Hop length for RMS energy computation (samples).
        min_silence_duration: Minimum silence duration to remove (seconds).
    """

    top_db: float = 30.0
    frame_length: int = 2048
    hop_length: int = 512
    min_silence_duration: float = 0.3


def remove_silence(
    audio: AudioBuffer,
    params: SilenceParams | None = None,
    trim_only: bool = False,
) -> AudioBuffer:
    """Remove or trim silent segments from audio.

    Args:
        audio: Input audio.
        params: Silence detection parameters (uses defaults if *None*).
        trim_only: If *True*, only trim leading/trailing silence
            (equivalent to ``AudioBuffer.trim_silence``).
            If *False*, also remove internal silent gaps.

    Returns:
        AudioBuffer with silence removed.
    """
    import librosa

    if params is None:
        params = SilenceParams()

    if trim_only:
        return audio.trim_silence(top_db=params.top_db)

    mono = audio.mono

    # Compute non-silent intervals
    intervals = librosa.effects.split(
        mono,
        top_db=params.top_db,
        frame_length=params.frame_length,
        hop_length=params.hop_length,
    )

    if len(intervals) == 0:
        # Entirely silent
        return AudioBuffer(
            data=np.array([], dtype=np.float32),
            sample_rate=audio.sample_rate,
            name=f"{audio.name}_trimmed",
        )

    # Filter out short silences: merge intervals that are separated by
    # less than min_silence_duration
    min_silence_samples = int(params.min_silence_duration * audio.sample_rate)
    merged: list[tuple[int, int]] = [tuple(intervals[0])]

    for start, end in intervals[1:]:
        prev_end = merged[-1][1]
        gap = start - prev_end
        if gap < min_silence_samples:
            # Merge with previous interval (keep the audio in between)
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))

    # Concatenate non-silent segments
    segments = [mono[s:e] for s, e in merged]
    concatenated = np.concatenate(segments)

    return AudioBuffer(
        data=concatenated.astype(np.float32),
        sample_rate=audio.sample_rate,
        name=f"{audio.name}_trimmed",
    )
