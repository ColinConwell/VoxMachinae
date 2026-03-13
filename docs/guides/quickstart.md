# Quick Start

This guide walks through the core DSP operations available in the Vox Machina library.

## Loading Audio

```python
from voxmachinae.core.audio_io import load_audio, save_audio, AudioBuffer

# Load from file (supports WAV, FLAC, OGG, MP3)
audio = load_audio("my_vocal.wav")

print(f"Duration: {audio.duration:.2f}s")
print(f"Sample rate: {audio.sample_rate} Hz")
print(f"Samples: {audio.samples.shape}")
```

## Pitch Detection

```python
from voxmachinae.core.pitch import detect_pitch

# Detect pitch using pYIN (default)
track = detect_pitch(audio)

print(f"Detected {len(track.times)} pitch frames")
print(f"Frequency range: {track.frequencies[track.voiced].min():.0f} - "
      f"{track.frequencies[track.voiced].max():.0f} Hz")

# Use CREPE for higher accuracy (requires tensorflow)
track_crepe = detect_pitch(audio, method="crepe", model_size="small")
```

## Auto-Tune

```python
from voxmachinae.core.autotune import AutoTune, AutoTuneParams

# Natural correction — subtle, musical
params = AutoTuneParams(
    key="C",
    scale="major",
    retune_speed=50,    # 0 = instant (robotic), 100 = very slow (natural)
    humanize=30,        # Preserve some natural pitch variation
)
tuner = AutoTune(params)
result = tuner.process(audio)

# T-Pain style — hard correction
from voxmachinae.presets.autotune_presets import AUTOTUNE_PRESETS
tpain = AutoTune(AUTOTUNE_PRESETS["t_pain"])
result = tpain.process(audio)

# Save the result
save_audio(result.audio, "autotuned.wav")
```

## Vocoder

```python
from voxmachinae.core.vocoder import (
    ChannelVocoder, ChannelVocoderParams,
    PhaseVocoder, PhaseVocoderParams,
)
from voxmachinae.synthesis.oscillators import generate_waveform

# Create a sawtooth carrier signal at the same length as the modulator
carrier = generate_waveform(
    "sawtooth",
    frequency=110.0,  # A2
    duration=audio.duration,
    sample_rate=audio.sample_rate,
)

# Channel vocoder — classic "robot voice"
params = ChannelVocoderParams(num_bands=32, carrier_type="sawtooth")
vocoder = ChannelVocoder(params)
result = vocoder.process(audio, carrier)

# Use a preset
from voxmachinae.presets.vocoder_presets import CHANNEL_VOCODER_PRESETS
daft_punk = ChannelVocoder(CHANNEL_VOCODER_PRESETS["daft_punk"])
result = daft_punk.process(audio, carrier)
```

## Effects

```python
from voxmachinae.core.effects import (
    apply_reverb, ReverbParams,
    apply_delay, DelayParams,
    apply_formant_shift, FormantShiftParams,
)

# Reverb — large hall
reverbed = apply_reverb(audio, ReverbParams(
    room_size=0.8,
    damping=0.5,
    wet=0.3,
))

# Delay — rhythmic echo
delayed = apply_delay(audio, DelayParams(
    delay_time=0.375,  # dotted eighth note at 120 BPM
    feedback=0.4,
    mix=0.3,
))

# Formant shift — change vocal character without changing pitch
shifted = apply_formant_shift(audio, FormantShiftParams(
    shift_semitones=3.0,  # Positive = higher/smaller voice
))
```

## Stem Separation

```python
from voxmachinae.core.separation import separate_stems, extract_vocals

# Full separation into 4 stems
result = separate_stems(audio)
save_audio(result.vocals, "vocals.wav")
save_audio(result.drums, "drums.wav")
save_audio(result.bass, "bass.wav")
save_audio(result.other, "other.wav")

# Quick vocal extraction
vocals_only = extract_vocals(audio)
```

!!! note
    Stem separation requires the `[audio-ml]` extra: `pip install -e ".[audio-ml]"`

## Denoising

```python
from voxmachinae.core.denoise import reduce_noise, enhance_speech

# Spectral gating noise reduction
clean = reduce_noise(audio)

# Neural speech enhancement (DeepFilterNet)
enhanced = enhance_speech(audio)
```

## Musical Scales

```python
from voxmachinae.core.scales import get_scale_frequencies, detect_key

# Get all note frequencies in C minor
freqs = get_scale_frequencies("C", "minor")

# Auto-detect the key of a recording
detected_key, detected_scale, confidence = detect_key(audio)
print(f"Detected: {detected_key} {detected_scale} ({confidence:.0%} confidence)")
```

## Next Steps

- Explore the [API Reference](../api/index.md) for complete parameter documentation
- Check the [DSP Glossary](../reference/glossary.md) for explanations of audio concepts
- Try the [Web App](webapp.md) for an interactive interface
