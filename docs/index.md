# Vox Machina

**AI-assisted vocal modulation, orchestration, and synthesis.**

Vox Machina is a Python DSP library and web application for experimenting with programmatic and AI-assisted vocal effects. It provides production-quality auto-tune, vocoder, reverb, delay, formant shifting, stem separation, denoising, and generative music capabilities — all accessible through a clean Python API or an interactive browser-based interface.

---

## Key Capabilities

<div class="grid cards" markdown>

- :material-tune: **Auto-Tune**
  Pitch detection (pYIN, CREPE) with configurable correction speed, humanize, formant preservation, and musical scale quantization.

- :material-waveform: **Vocoder**
  Channel, phase, and LPC vocoders with built-in carrier synthesis. Classic "Daft Punk" and "Kraftwerk" presets included.

- :material-volume-high: **Effects**
  Reverb, delay/echo, formant shifting, spectral denoising, and loudness normalization.

- :material-music-note-split: **Stem Separation**
  Demucs v4-powered source separation into vocals, drums, bass, and other.

- :material-robot: **AI Agents**
  LiteLLM-powered coaching agent that explains DSP concepts and suggests parameter adjustments.

- :material-creation: **Generative Music**
  Integration with Kie AI/Suno, ElevenLabs, and Stability AI for text-to-music generation.

</div>

## Quick Example

```python
from voxmachinae.core.audio_io import load_audio
from voxmachinae.core.autotune import AutoTune, AutoTuneParams

# Load a vocal recording
audio = load_audio("vocal.wav")

# Auto-tune to C major with natural correction speed
params = AutoTuneParams(key="C", scale="major", retune_speed=50)
tuner = AutoTune(params)
result = tuner.process(audio)

# result.audio contains the pitch-corrected output
```

## Web Application

The included web app provides a full-featured interface with real-time waveform visualization, analog-style controls, drag-and-drop effects chaining, and an AI chat assistant.

![Vox Machina Web App](assets/screenshot.png){ .screenshot }

## Getting Started

Head to the [Installation Guide](guides/installation.md) to set up the library, or jump straight to the [Quick Start](guides/quickstart.md) for code examples.
