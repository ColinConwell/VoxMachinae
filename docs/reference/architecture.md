# Architecture

An overview of the Vox Machina project structure and design decisions.

## Repository Layout

```
VoxMachinae/
├── voxmachinae/                # Python library (pip-installable)
│   ├── core/                   # DSP engine
│   │   ├── audio_io.py         # Audio loading, saving, format conversion
│   │   ├── pitch.py            # Pitch detection (pYIN, CREPE, Praat)
│   │   ├── autotune.py         # Auto-tune pipeline
│   │   ├── vocoder.py          # Channel, phase, and LPC vocoders
│   │   ├── effects.py          # Reverb, delay, formant shifting
│   │   ├── scales.py           # Musical scales and key detection
│   │   ├── separation.py       # Demucs stem separation
│   │   └── denoise.py          # Noise reduction and speech enhancement
│   ├── synthesis/              # Carrier signal generation
│   │   ├── oscillators.py      # Waveform generators (saw, square, sine, noise)
│   │   └── midi.py             # MIDI note/scale utilities
│   ├── ai/                     # AI-powered features
│   │   ├── agents/             # LiteLLM-based coaching agent
│   │   └── generative/         # Kie AI/Suno, ElevenLabs, Stable Audio clients
│   ├── presets/                # Parameter presets for auto-tune and vocoder
│   └── utils/                  # Visualization and sample management
├── webapp/
│   ├── backend/                # FastAPI + WebSocket server
│   │   └── main.py             # Routes, WebSocket handlers, session management
│   └── frontend/               # React + TypeScript SPA
│       └── src/
│           ├── components/     # UI components (panels, controls, visualizations)
│           ├── hooks/          # Custom React hooks
│           └── audio/          # Web Audio API integration
├── docs/                       # MkDocs documentation site
├── samples/                    # Built-in audio samples
└── scripts/                    # Utility scripts
```

## Design Principles

### Parallel Library + Web App

The Python library and web application are developed in parallel. Every DSP capability in the library is immediately exposed through the web app's API, ensuring the library stays practical and the web app stays feature-complete.

### Progressive Disclosure

Controls are organized in layers of complexity:

1. **Beginner**: Preset selector + single "amount" slider
2. **Intermediate**: Individual labeled parameter controls
3. **Advanced**: Full DSP parameter access, custom scales, effects chaining

### Dual Processing Modes

- **Upload & Process**: Offline mode for highest quality. Audio is uploaded, processed server-side, and returned as a downloadable file.
- **Real-time Streaming**: Near-real-time mode (~50-100ms latency) via WebSocket for live parameter tweaking and audio preview.

## Data Flow

### Upload & Process

```
Browser                    FastAPI                  voxmachinae
  │                          │                         │
  │── POST /api/upload ─────>│                         │
  │                          │── load_audio() ────────>│
  │                          │<── AudioBuffer ─────────│
  │                          │── store in session       │
  │<── session_id ───────────│                         │
  │                          │                         │
  │── POST /api/process/* ──>│                         │
  │                          │── AutoTune.process() ──>│
  │                          │<── result ──────────────│
  │<── processed audio ──────│                         │
```

### Real-time Streaming

```
Browser                    FastAPI                  voxmachinae
  │                          │                         │
  │── WS connect ───────────>│                         │
  │── audio chunks ─────────>│                         │
  │                          │── process chunk ───────>│
  │                          │<── processed chunk ─────│
  │<── processed chunks ─────│                         │
  │                          │                         │
  │── parameter update ─────>│                         │
  │                          │── update params ───────>│
  │                          │ (applied to next chunk)  │
```

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Audio DSP** | NumPy + SciPy + librosa | Industry-standard, well-documented, vectorized |
| **Pitch Detection** | pYIN (default), CREPE, Praat | Multiple accuracy/speed tradeoffs |
| **Pitch Shifting** | pyworld (WORLD vocoder) | Best for voice: explicit F0 + formant control |
| **Stem Separation** | Demucs v4 | State-of-the-art neural source separation |
| **Speech Enhancement** | DeepFilterNet + noisereduce | Neural + spectral gating fallback |
| **AI Framework** | LiteLLM | Model-agnostic (Claude, GPT, Gemini, etc.) |
| **Backend** | FastAPI | Async, fast, first-class WebSocket support |
| **Frontend** | React + TypeScript | Rich ecosystem, Tone.js/wavesurfer.js integration |
| **Waveform** | wavesurfer.js | Best-in-class waveform visualization |
| **Styling** | Tailwind CSS | Rapid iteration with custom design system |

## Session Management

Each user interaction creates a session with:

- A unique `session_id`
- Original audio stored as a temporary file
- Processed audio (overwritten with each new effect application)
- Effect chain state (ordered list of effects + parameters)

Sessions are stored in-memory with filesystem backing for audio files. The `SessionManager` handles creation, retrieval, and cleanup.

## Effects Chain

The effects chain is an ordered list of processing nodes. Each node has:

- An effect type (autotune, vocoder, reverb, delay, formant, denoise)
- Parameters specific to that effect
- An enabled/disabled toggle
- A position in the chain

Processing applies each enabled effect in sequence, passing the output of one as the input to the next.
