# Vox Machina

**AI-assisted vocal modulation and orchestration for music production.**

## Overview

Vox Machina (`voxmachinae`) is a Python library and companion web application for real-time vocal processing, pitch correction, and audio synthesis. It brings together classic DSP techniques -- auto-tune, channel vocoders, reverb, delay -- with modern ML-powered tools like stem separation (Demucs), speech enhancement (DeepFilterNet), and generative music APIs.

The core library is designed for programmatic use in scripts, notebooks, and production pipelines. Everything operates on a simple `AudioBuffer` container, and effects can be composed freely. Pitch detection supports multiple backends (pYIN, CREPE, Praat), and the auto-tune engine uses the WORLD vocoder for high-quality formant-preserving pitch correction.

The web app provides a browser-based interface with analog-style knobs, real-time waveform visualization, drag-and-drop effects chaining, and WebSocket-driven audio streaming -- built with React, Tone.js, and a FastAPI backend.

## Features

### Core DSP

- **Auto-tune** -- Scale-aware pitch correction with configurable retune speed, humanize, flex-tune, and formant preservation (WORLD vocoder)
- **Channel vocoder** -- Classic filter-bank vocoder with envelope followers, sibilance injection, and configurable carrier signals
- **Phase vocoder** -- STFT-based cross-synthesis, robotize, whisperize, and spectral freeze effects
- **LPC vocoder** -- Linear predictive coding vocoder for classic robot/radio voice textures
- **Reverb** -- Schroeder feedback delay network with room size and damping controls
- **Delay** -- Multi-tap echo with feedback decay
- **Formant shifting** -- Shift vocal tract resonances independently of pitch (chipmunk to deep voice)
- **Denoising** -- Spectral-gating noise reduction and DeepFilterNet speech enhancement
- **Stem separation** -- Isolate vocals, drums, bass, and other instruments via Demucs (htdemucs, htdemucs_ft, mdx_extra)
- **Loudness normalization** -- LUFS-based loudness targeting with pyloudnorm

### AI Features

- **Coaching agent** -- LLM-powered audio production tutor that explains DSP concepts, suggests parameters, and provides learning paths (via LiteLLM / Anthropic SDK)
- **Generative music** -- Unified async interface to multiple music generation APIs:
  - Kie AI / Suno
  - ElevenLabs Music
  - Stable Audio

### Web App

- Real-time waveform and spectral visualization
- Analog-style rotary controls for effect parameters
- Drag-and-drop effects chain with dnd-kit
- WebSocket audio streaming between browser and server
- Built with React 19, Tailwind CSS 4, Tone.js, and Vite

## Quick Start

### Install the core library

```bash
pip install -e .
```

### Install with ML features (Demucs, DeepFilterNet, loudness normalization)

```bash
pip install -e ".[audio-ml]"
```

### Install with web app dependencies

```bash
pip install -e ".[web]"
```

### Install everything for development

```bash
pip install -e ".[audio-ml,web,dev]"
```

**Requirements:** Python 3.10+

## Library Usage

### Load audio and detect pitch

```python
from voxmachinae import load_audio, detect_pitch

audio = load_audio("vocals.wav")
pitch = detect_pitch(audio.data, audio.sample_rate, method="pyin")

for t, f, v in zip(pitch.times, pitch.frequencies, pitch.voiced):
    if v:
        print(f"  {t:.2f}s -> {f:.1f} Hz")
```

### Apply auto-tune

```python
from voxmachinae.core.autotune import AutoTune, AutoTuneParams

at = AutoTune(AutoTuneParams(key="C", scale_type="major", retune_speed=0))
result = at.process(audio)

result.audio          # pitch-corrected AudioBuffer
result.correction_amounts  # per-frame correction in cents
```

### Run a channel vocoder

```python
from voxmachinae.core.vocoder import ChannelVocoder, ChannelVocoderParams

vocoder = ChannelVocoder(ChannelVocoderParams(
    n_bands=32,
    carrier_type="saw",
    carrier_freq=100.0,
    sibilance=0.3,
))
vocoded = vocoder.process(voice_audio)
```

### Apply reverb and delay

```python
from voxmachinae.core.effects import apply_reverb, apply_delay, ReverbParams, DelayParams

wet = apply_reverb(audio, ReverbParams(room_size=0.7, damping=0.4, wet=0.35))
echoed = apply_delay(audio, DelayParams(delay_time=0.25, feedback=0.5))
```

### Save output

```python
from voxmachinae import save_audio

save_audio(result.audio, "output.wav")
```

## Web App

### Backend (FastAPI + WebSocket)

```bash
cd webapp/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React + Vite)

```bash
cd webapp/frontend
npm install
npm run dev
```

The frontend dev server will start at `http://localhost:5173` and proxy API requests to the backend at `http://localhost:8000`.

## Architecture

```
voxmachinae/
  core/           # Audio I/O, pitch detection, auto-tune, vocoder, effects, denoising, separation
  synthesis/      # Oscillators and MIDI utilities
  ai/
    agents/       # LLM-powered coaching agent
    generative/   # Music generation API clients (Kie/Suno, ElevenLabs, Stable Audio)
    neural/       # Neural audio processing hooks
  presets/        # Curated parameter presets for auto-tune and vocoder
  utils/          # Visualization helpers and sample management

webapp/
  backend/        # FastAPI server with WebSocket audio streaming
  frontend/       # React 19 + Tailwind CSS 4 + Tone.js UI
```

## Tech Stack

| Layer | Technology |
|---|---|
| DSP core | NumPy, SciPy, librosa, pyworld |
| Pitch detection | pYIN (librosa), CREPE, Praat |
| Stem separation | Demucs (Meta) |
| Speech enhancement | DeepFilterNet |
| AI / LLM | LiteLLM, Anthropic SDK |
| Generative music | Kie AI / Suno, ElevenLabs, Stable Audio |
| Backend | FastAPI, uvicorn, WebSockets |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Tone.js, Vite |
| Drag-and-drop | dnd-kit |
| Audio I/O | soundfile, sounddevice |

## License

MIT
