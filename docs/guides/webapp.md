# Web Application

The Vox Machina web app provides a browser-based interface for all library features, with real-time waveform visualization, analog-style controls, and an AI chat assistant.

## Running the App

### Start the Backend

```bash
cd webapp/backend
pip install -e ".[web]"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Visit `/docs` for the interactive Swagger UI.

### Start the Frontend

```bash
cd webapp/frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Features

### Audio Input

- **Record**: Click the microphone button to record directly from your browser
- **Upload**: Drag and drop audio files (WAV, MP3, FLAC, OGG) or click to browse
- **Sample Library**: Browse built-in vocal samples organized by category

### Waveform Display

The waveform section shows both the original and processed audio side-by-side using wavesurfer.js. Click anywhere on the waveform to seek, and use the play/pause controls for playback.

### Effect Panels

Click any effect button to open its control panel:

| Effect | Description | Color |
|--------|-------------|-------|
| **Auto-Tune** | Pitch correction with key/scale selection | Amber |
| **Vocoder** | Channel vocoder with carrier selection | Violet |
| **Stems** | Neural source separation (vocals/drums/bass/other) | Cyan |
| **Reverb** | Room simulation with size/damping controls | Rose |
| **Delay** | Echo effect with time/feedback/mix | Sky |
| **Formant** | Vocal character shifting | Teal |
| **Denoise** | Noise reduction and speech enhancement | Lime |
| **Generate** | AI music generation (Kie AI/Suno, ElevenLabs, Stable Audio) | Fuchsia |
| **AI** | Chat with an AI assistant about your audio | Indigo |

### Effects Chain

The effects chain panel at the bottom lets you build a processing pipeline by enabling multiple effects in sequence. Drag to reorder, toggle effects on/off, run the chain, and review any stage failures directly in the UI.

### Export

After processing, click the **Export** button to download the processed audio as a WAV file.

## API Endpoints

The backend exposes a REST + WebSocket API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload an audio file |
| `/api/session/{id}/waveform` | GET | Get waveform data |
| `/api/session/{id}/download` | GET | Download audio |
| `/api/session/{id}/reset` | POST | Reset processed audio to the original source |
| `/api/process/autotune` | POST | Apply auto-tune |
| `/api/process/vocoder` | POST | Apply vocoder |
| `/api/process/effect` | POST | Apply reverb, delay, or formant shift |
| `/api/process/denoise` | POST | Apply denoising |
| `/api/process/separate` | POST | Stem separation |
| `/api/separation/options` | GET | List separation engines, models, and stems |
| `/api/chain/run/{id}` | POST | Apply the effects chain |
| `/api/generate` | POST | Generate music via AI |
| `/api/ai/chat` | POST | AI chat assistant |
| `/ws/{id}` | WS | Real-time audio streaming |

Visit `http://localhost:8000/docs` for the full interactive API documentation.

## Environment Variables

The frontend uses Vite environment variables:

```bash
# webapp/frontend/.env
VITE_API_URL=http://localhost:8000
```

The backend reads API keys from the project root's `.env.local` file.
