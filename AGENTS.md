# AGENTS.md — VoxMachinae

> Guidelines for AI agents and human developers working on this codebase.

## Project Overview

VoxMachinae is an AI-assisted vocal modulation and orchestration library (Python) with a companion web application. It combines classic DSP (auto-tune, vocoders, reverb) with ML-powered tools (Demucs stem separation, DeepFilterNet denoising) and generative music APIs (Suno, ElevenLabs, Stable Audio). The core library operates on `AudioBuffer` containers; the web app wraps it in a FastAPI backend + React 19 frontend with WebSocket streaming.

## Repository Structure

```
VoxMachinae/
├── README.md
├── AGENTS.md                          # ← you are here
├── LICENSE                            # MIT
├── pyproject.toml                     # Python project config (hatchling build)
├── mkdocs.yml                         # MkDocs Material documentation config
├── .gitignore
│
├── voxmachinae/                       # ── Python library ──
│   ├── __init__.py                    # Public API re-exports
│   ├── core/
│   │   ├── audio_io.py               # AudioBuffer container, load/save/record
│   │   ├── pitch.py                  # Pitch detection (pYIN, CREPE, Praat)
│   │   ├── autotune.py               # Scale-based pitch correction (WORLD vocoder)
│   │   ├── vocoder.py                # Channel, Phase, and LPC vocoders
│   │   ├── effects.py                # Reverb, delay, formant shifting
│   │   ├── scales.py                 # Musical scales, key detection (Krumhansl)
│   │   ├── denoise.py                # Noise reduction, DeepFilterNet, loudness norm
│   │   └── separation.py             # Demucs stem separation
│   ├── synthesis/
│   │   ├── oscillators.py            # Waveform generation (sine, saw, square, etc.)
│   │   └── midi.py                   # MIDI utilities
│   ├── ai/
│   │   ├── agents/
│   │   │   └── coach.py              # LLM coaching agent (coach/producer/mixer modes)
│   │   ├── generative/
│   │   │   ├── base.py               # Abstract GenerativeEngine interface
│   │   │   ├── kie_suno.py           # Kie AI / Suno v4-v5 music generation
│   │   │   ├── elevenlabs_music.py   # ElevenLabs music generation
│   │   │   └── stable_audio.py       # Stable Audio generation
│   │   └── neural/                   # (placeholder for future neural processing)
│   ├── presets/
│   │   ├── autotune_presets.py        # Curated auto-tune parameter sets
│   │   └── vocoder_presets.py         # Curated vocoder parameter sets
│   └── utils/
│       ├── samples.py                 # Sample library management + catalog
│       └── visualization.py           # Waveform, spectrogram, pitch plotting
│
├── webapp/                            # ── Web application ──
│   ├── backend/
│   │   ├── main.py                   # FastAPI server (~1000 lines): REST + WebSocket
│   │   └── session.py                # SessionManager, EffectNode chain management
│   └── frontend/
│       ├── package.json              # React 19, Tailwind 4, Tone.js, Vite 8
│       ├── vite.config.ts
│       ├── index.html
│       ├── tsconfig.json
│       └── src/
│           ├── main.tsx              # Entry point (wraps App in BackgroundProvider)
│           ├── App.tsx               # Main layout — glass-morphic dark theme
│           ├── App.css               # Glass-card utilities, glow effects, animations
│           ├── index.css             # Design system: CSS variables, fonts, gradients
│           ├── contexts/
│           │   └── BackgroundContext.tsx  # Background mode state + localStorage
│           └── components/
│               ├── AudioRecorder.tsx
│               ├── WaveformView.tsx       # wavesurfer.js waveform display
│               ├── AutoTunePanel.tsx
│               ├── VocoderPanel.tsx
│               ├── ReverbPanel.tsx
│               ├── DelayPanel.tsx
│               ├── FormantPanel.tsx
│               ├── DenoisePanel.tsx
│               ├── StemSeparationPanel.tsx
│               ├── EffectsChainPanel.tsx   # Drag-and-drop via dnd-kit
│               ├── GenerativePanel.tsx     # Music generation UI
│               ├── AIChatPanel.tsx         # AI coaching chat
│               ├── SampleBrowser.tsx       # Browse + play sample library
│               ├── DebugPanel.tsx
│               ├── GuidedTour.tsx
│               ├── HelpTooltip.tsx
│               ├── WaveBackground.tsx      # Background mode switcher
│               └── backgrounds/
│                   ├── WaveGrid.tsx        # 3D perspective wave grid (canvas)
│                   ├── ParticleField.tsx   # Interactive particle system (canvas)
│                   ├── StaticGradient.tsx  # CSS-only animated gradient
│                   └── BackgroundToggle.tsx # Cycle background modes
│
├── docs/                              # ── MkDocs documentation ──
│   ├── index.md
│   ├── guides/
│   │   ├── installation.md
│   │   ├── quickstart.md
│   │   └── webapp.md
│   ├── api/                           # Per-module API reference
│   │   ├── audio_io.md, autotune.md, denoise.md, effects.md,
│   │   │   pitch.md, presets.md, scales.md, separation.md,
│   │   │   synthesis.md, vocoder.md
│   │   └── index.md
│   └── reference/
│       ├── architecture.md
│       └── glossary.md
│
├── notebooks/
│   ├── 01_getting_started.ipynb
│   └── 02_vocoder_deep_dive.ipynb
│
└── scripts/
    └── populate_samples.py            # Download CC-licensed samples from Freesound
```

## Development Philosophy

### Design Principles

- **AudioBuffer as universal currency.** Every DSP function accepts and returns `AudioBuffer` (float32 numpy arrays normalized to [-1, 1]). Mono/stereo, sample rate, and name metadata travel with the audio.
- **Dataclass params for every effect.** Each effect has a corresponding `*Params` dataclass (`AutoTuneParams`, `ReverbParams`, `ChannelVocoderParams`, etc.). Never use raw dicts for configuration.
- **Compose freely.** Effects can be chained in any order. The web app's `EffectNode` system enforces this pattern — each node wraps a type + params + enabled flag.
- **Async-first for AI/generative.** All LLM and music generation APIs use `async/await`. The FastAPI backend exposes async endpoints accordingly.
- **Model-agnostic AI.** The coaching agent uses LiteLLM for model routing so any supported LLM backend works. Anthropic SDK is available as a direct fallback.

### UI / Frontend Preferences

- **Glass-morphic dark theme.** The frontend uses a dark background (`#0a0a12` / `#0d0b1a`) with semi-transparent glass cards (`backdrop-blur`, `bg-white/5`), amber (#FBBF24) and violet (#8B5CF6) accent colors.
- **Calm, ambient backgrounds.** Background visualizations should be slow and atmospheric — gentle ocean waves, drifting particles, breathing gradients. Never flashy or seizure-inducing. Animation speed should feel like natural phenomena.
- **Typography:** Syne (display/headings) and Outfit (body text). Both loaded from Google Fonts.
- **Tailwind CSS 4** for utility styling. Custom CSS variables defined in `index.css` for the design system.
- **Entrance animations** (`.animate-fade-up`, `.delay-100` through `.delay-500`) for staggered component loading.

### Code Style

- **Python:** Ruff for linting. Target Python 3.10. Line length 100. Google-style docstrings.
- **TypeScript:** Strict mode. React 19 with function components and hooks only. No class components.
- **Commits:** Descriptive multi-line commit messages. First line is a summary, body explains what and why.

## Tech Stack

| Layer | Technology |
|---|---|
| DSP core | NumPy, SciPy, librosa, pyworld |
| Pitch detection | pYIN (librosa), CREPE, Praat (parselmouth) |
| Stem separation | Demucs (htdemucs, htdemucs_ft, mdx_extra) |
| Speech enhancement | DeepFilterNet |
| AI / LLM | LiteLLM, Anthropic SDK |
| Generative music | Kie AI / Suno, ElevenLabs, Stable Audio |
| Backend | FastAPI, uvicorn, WebSockets |
| Frontend | React 19, TypeScript 5.9, Tailwind CSS 4, Vite 8 |
| Audio visualization | wavesurfer.js, Tone.js |
| Drag-and-drop | dnd-kit (core, sortable, utilities) |
| Audio I/O | soundfile, sounddevice |
| Build system | hatchling (Python), Vite (frontend) |
| Documentation | MkDocs Material + mkdocstrings |
| Testing | pytest, pytest-asyncio |

## Setup

### Python library

```bash
pip install -e ".[audio-ml,web,dev]"   # all extras
```

Requires Python 3.10+. Heavy ML dependencies (Demucs, DeepFilterNet) are in the `audio-ml` extra to keep the core install light.

### Frontend

```bash
cd webapp/frontend
npm install
npm run dev          # → http://localhost:5173
```

### Backend

```bash
cd webapp/backend
uvicorn main:app --reload   # → http://localhost:8000
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

### Sample Library

Samples are **not tracked in git** (`.gitignore` excludes `voxmachinae/samples/*.mp3|.ogg|.wav` and `catalog.json`). To populate:

```bash
python scripts/populate_samples.py
```

This downloads CC0/CC-BY-4.0 licensed vocal samples from Freesound (no auth required — uses CDN preview URLs). It can also generate samples via the Suno API if `KIE_API_KEY` is set.

### Environment Variables

Create a `.env.local` file at the repo root. Key variables:

| Variable | Purpose | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI coaching agent | For AI features |
| `KIE_API_KEY` | Kie AI / Suno music generation | For generative features |
| `KIE_WEBHOOK_HMAC_KEY` | Suno webhook verification | For generative features |
| `ELEVENLABS_API_KEY` | ElevenLabs music generation | Optional |
| `STABILITY_API_KEY` | Stable Audio generation | Optional |
| `OPENAI_API_KEY` | Alternative LLM backend | Optional |
| `GOOGLE_GENAI_API_KEY` | Alternative LLM backend | Optional |

The core DSP library works without any API keys.

### Documentation

```bash
pip install mkdocs-material mkdocstrings[python]
mkdocs serve          # → http://localhost:8000/docs
mkdocs build          # → site/
```

## Known Issues & Gotchas

### Audio / DSP

- **Demucs requires stereo input.** If you pass mono audio to `separate_stems()`, it silently duplicates to stereo before processing. The output stems will be stereo even if input was mono.
- **WORLD vocoder (pyworld)** is used for formant-preserving pitch shifting in auto-tune. It expects float64 input — `autotune.py` handles the conversion internally, but be aware if calling pyworld directly.
- **CREPE pitch detection** is significantly slower than pYIN but more accurate on noisy audio. Default to `method="pyin"` for interactive use.
- **DeepFilterNet** and Demucs are heavy dependencies. They're isolated behind the `[audio-ml]` optional extra so the core library can install without them.

### Web App

- **Backend `main.py` is large** (~1000 lines). It's a single-file FastAPI server handling REST, WebSocket, session management, AI chat, and generative endpoints. Future refactoring could split it into route modules, but it works as-is.
- **WebSocket audio streaming** uses raw binary frames. The protocol is not formally documented beyond the code — see the `ws_endpoint()` handler in `main.py` and the corresponding frontend `AudioRecorder.tsx`.
- **CORS is wide open in dev mode** (`allow_origins=["*"]`). This should be restricted for any production deployment.
- **No authentication.** The web app has no user auth. Sessions are ephemeral and identified by random UUIDs.

### Sample Library

- **Freesound CDN preview URLs** follow the pattern `https://cdn.freesound.org/previews/{folder}/{sound_id}_{user_id}-hq.mp3`. These don't require API authentication but are dependent on exact `sound_id` and `user_id` — if either is wrong, you get a 404. The `populate_samples.py` script has all verified working URLs.
- **One non-vocal test sample** (`sine_440hz`) is intentionally kept in the library as a test case for verifying how effects handle non-vocal input. It's tagged with `non_vocal_test` and `test_case`. All other samples should contain actual vocal content.
- **Samples are generated/downloaded at runtime**, not bundled in the repo. The `voxmachinae/samples/` directory will be empty in a fresh clone until `populate_samples.py` is run.

### Frontend

- **Background animations** (WaveGrid, ParticleField) use `requestAnimationFrame` + canvas. The BackgroundToggle in the bottom-right corner lets users switch to the lightweight StaticGradient (CSS-only) mode. The preference persists in `localStorage` under the key `voxmachinae-bg-mode`.
- **React 19** is used — some patterns differ from React 18 (e.g., `ref` as a prop on function components). Ensure any new components are compatible.
- **Tailwind CSS 4** (not 3) — configuration is done via CSS (`@theme` directives in `index.css`), not `tailwind.config.js`.

### Build & Deploy

- **No CI/CD pipeline yet.** No `.github/workflows/` directory exists. Testing and linting are manual (`pytest`, `ruff check`).
- **No Docker configuration.** Running locally with `uvicorn` + `npm run dev` is the expected workflow.
- **`firebase-debug.log`** may appear in the root — it's gitignored. Firebase was explored but is not actively used for deployment.

## Testing

```bash
pytest                        # run all tests
pytest -x                     # stop on first failure
pytest tests/test_pitch.py    # run specific module
```

Test configuration is in `pyproject.toml` under `[tool.pytest.ini_options]`:
- `testpaths = ["tests"]`
- `asyncio_mode = "auto"` (pytest-asyncio auto-detects async test functions)

## Key Patterns

### Adding a New Effect

1. Create a `*Params` dataclass in the appropriate `core/` module
2. Implement the processing function that takes `AudioBuffer` + params → `AudioBuffer`
3. Add a preset in `presets/` if useful
4. Register the effect type in `webapp/backend/session.py` (`EffectNode`)
5. Add a backend endpoint in `main.py`
6. Create a React panel component in `webapp/frontend/src/components/`
7. Wire the panel into `App.tsx` and the effects chain

### Adding a New Generative API

1. Subclass `GenerativeEngine` from `ai/generative/base.py`
2. Implement `generate()`, `check_status()`, `download()`
3. Add the client in `ai/generative/`
4. Add the corresponding endpoint in `main.py`
5. Extend `GenerativePanel.tsx` in the frontend

### Background Modes

Background visuals are managed by `BackgroundContext`. To add a new background:

1. Create a component in `components/backgrounds/` (canvas-based or CSS-only)
2. Add the mode name to `BackgroundMode` type in `contexts/BackgroundContext.tsx`
3. Add it to the `BACKGROUND_MODES` array
4. Add a rendering branch in `WaveBackground.tsx`
5. Add an icon/label in `BackgroundToggle.tsx`
