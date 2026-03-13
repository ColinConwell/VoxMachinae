# API Reference

The `voxmachinae` library is organized into several subpackages:

## Core DSP (`voxmachinae.core`)

The main signal processing modules:

| Module | Description |
|--------|-------------|
| [`audio_io`](audio_io.md) | Audio loading, saving, recording, and format conversion |
| [`pitch`](pitch.md) | Pitch detection using pYIN, CREPE, and Praat |
| [`autotune`](autotune.md) | Auto-tune pipeline with configurable correction |
| [`vocoder`](vocoder.md) | Channel, phase, and LPC vocoders |
| [`effects`](effects.md) | Reverb, delay, and formant shifting |
| [`scales`](scales.md) | Musical scales, key detection, and note utilities |
| [`separation`](separation.md) | Neural stem separation via Demucs |
| [`denoise`](denoise.md) | Noise reduction and speech enhancement |

## Synthesis (`voxmachinae.synthesis`)

Carrier signal generation for vocoder processing:

| Module | Description |
|--------|-------------|
| [`synthesis`](synthesis.md) | Oscillators, noise generators, and MIDI utilities |

## Presets (`voxmachinae.presets`)

Ready-to-use parameter configurations:

| Module | Description |
|--------|-------------|
| [`presets`](presets.md) | Auto-tune and vocoder presets |

## AI (`voxmachinae.ai`)

AI-powered features (require API keys):

| Module | Description |
|--------|-------------|
| `ai.agents.coach` | LiteLLM-powered coaching and tutorial agent |
| `ai.generative.kie_suno` | Kie AI / Suno music generation client |
| `ai.generative.elevenlabs_music` | ElevenLabs music composition client |
| `ai.generative.stable_audio` | Stability AI Stable Audio client |
