# Installation

## Requirements

- Python 3.10+
- NumPy, SciPy, librosa (installed automatically)
- For ML features: PyTorch, Demucs, DeepFilterNet (optional)

## Core Library

Install the base library with all DSP capabilities:

```bash
pip install -e .
```

This gives you auto-tune, vocoder, reverb, delay, formant shifting, pitch detection, scales, and synthesis.

## ML Features

For neural stem separation (Demucs) and speech enhancement (DeepFilterNet):

```bash
pip install -e ".[audio-ml]"
```

!!! note "GPU Acceleration"
    If you have a CUDA-capable GPU, install PyTorch with CUDA support first:
    ```bash
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
    pip install -e ".[audio-ml]"
    ```

## Web Application

### Backend

```bash
cd webapp/backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd webapp/frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173` and connect to the backend at `http://localhost:8000`.

## Development Setup

For contributing or development:

```bash
git clone https://github.com/colinconwell/VoxMachinae.git
cd VoxMachinae
pip install -e ".[audio-ml]"
cd webapp/backend && pip install -r requirements.txt
cd ../frontend && npm install
```

## Environment Variables

Create a `.env.local` file in the project root for API keys (used by generative music features and AI agents):

```bash
# Generative Music APIs
KIE_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
STABILITY_API_KEY=your_key_here

# AI Agent Providers
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
```

!!! tip
    Only the core DSP features require no API keys. Generative music and AI agent features are optional and require their respective API keys.
