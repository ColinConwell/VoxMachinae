"""Sample library management: bundled samples, downloading, and cataloging.

Provides utilities for managing a library of audio samples that can be used
for testing and demonstrating auto-tune, vocoder, and other vocal effects.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from voxmachinae.core.audio_io import AudioBuffer, load_audio


# Default samples directory inside the package data
_SAMPLES_DIR = Path(__file__).parent.parent / "samples"

# User-configurable samples directory (e.g. ~/.voxmachina/samples)
_USER_SAMPLES_DIR = Path.home() / ".voxmachina" / "samples"


@dataclass
class SampleInfo:
    """Metadata for an audio sample."""

    name: str
    filename: str
    description: str = ""
    category: str = "general"  # vocal, speech, singing, instrument, generated
    duration: float = 0.0
    sample_rate: int = 44100
    license: str = "unknown"
    source_url: str = ""
    tags: list[str] = field(default_factory=list)


# Built-in sample catalog — populated as samples are added
SAMPLE_CATALOG: dict[str, SampleInfo] = {}


def get_samples_dir(user_dir: bool = False) -> Path:
    """Get the samples directory path, creating it if needed."""
    d = _USER_SAMPLES_DIR if user_dir else _SAMPLES_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def list_samples(
    category: str | None = None,
    include_user: bool = True,
) -> list[SampleInfo]:
    """List all available samples, optionally filtered by category.

    Args:
        category: Filter to a specific category (vocal, speech, singing, etc.)
        include_user: Also search user samples directory.

    Returns:
        List of SampleInfo for all matching samples.
    """
    results: list[SampleInfo] = []
    dirs = [_SAMPLES_DIR]
    if include_user:
        dirs.append(_USER_SAMPLES_DIR)

    for d in dirs:
        if not d.exists():
            continue

        # Check for catalog.json
        catalog_path = d / "catalog.json"
        if catalog_path.exists():
            with open(catalog_path) as f:
                catalog = json.load(f)
            for entry in catalog.get("samples", []):
                info = SampleInfo(**entry)
                if category is None or info.category == category:
                    results.append(info)
        else:
            # Fall back to scanning audio files
            for ext in ("*.wav", "*.mp3", "*.flac", "*.ogg"):
                for fp in d.glob(ext):
                    info = SampleInfo(
                        name=fp.stem,
                        filename=fp.name,
                        category="unknown",
                    )
                    if category is None or info.category == category:
                        results.append(info)

    return results


def load_sample(
    name: str,
    sr: int | None = None,
    mono: bool = True,
) -> AudioBuffer:
    """Load a sample by name from the sample library.

    Searches both bundled and user sample directories.

    Args:
        name: Sample name (without extension) or filename.
        sr: Target sample rate. None keeps original.
        mono: Convert to mono.

    Returns:
        AudioBuffer with the loaded sample.

    Raises:
        FileNotFoundError: If the sample is not found.
    """
    # Search in both directories
    for d in (_SAMPLES_DIR, _USER_SAMPLES_DIR):
        if not d.exists():
            continue

        # Try exact filename first
        path = d / name
        if path.exists():
            return load_audio(path, sr=sr, mono=mono)

        # Try common extensions
        for ext in (".wav", ".mp3", ".flac", ".ogg"):
            path = d / f"{name}{ext}"
            if path.exists():
                return load_audio(path, sr=sr, mono=mono)

    raise FileNotFoundError(
        f"Sample '{name}' not found in {_SAMPLES_DIR} or {_USER_SAMPLES_DIR}"
    )


def download_sample(
    url: str,
    name: str,
    category: str = "downloaded",
    description: str = "",
    license_info: str = "unknown",
    user_dir: bool = True,
) -> Path:
    """Download an audio sample from a URL.

    Args:
        url: URL to download from.
        name: Name for the sample (used as filename stem).
        category: Sample category.
        description: Human-readable description.
        license_info: License information string.
        user_dir: Save to user directory (True) or package directory (False).

    Returns:
        Path to the downloaded file.
    """
    samples_dir = get_samples_dir(user_dir=user_dir)

    # Determine extension from URL
    url_path = url.split("?")[0]
    ext = Path(url_path).suffix or ".wav"
    filename = f"{name}{ext}"
    dest = samples_dir / filename

    if dest.exists():
        return dest

    # Download (use proper User-Agent to avoid 403s from CDNs)
    print(f"Downloading {name} from {url}...")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "VoxMachina/0.1 (audio sample downloader)"},
    )
    with urllib.request.urlopen(req) as resp:
        dest.write_bytes(resp.read())

    # Update catalog
    _update_catalog(
        samples_dir,
        SampleInfo(
            name=name,
            filename=filename,
            description=description,
            category=category,
            license=license_info,
            source_url=url,
        ),
    )

    return dest


def add_sample(
    source_path: str | Path,
    name: str | None = None,
    category: str = "user",
    description: str = "",
    user_dir: bool = True,
) -> Path:
    """Add a local audio file to the sample library.

    Args:
        source_path: Path to the audio file to add.
        name: Name for the sample. Defaults to the file stem.
        category: Sample category.
        description: Description of the sample.
        user_dir: Save to user directory.

    Returns:
        Path to the copied file in the sample library.
    """
    source = Path(source_path)
    if not source.exists():
        raise FileNotFoundError(f"Source file not found: {source}")

    samples_dir = get_samples_dir(user_dir=user_dir)
    filename = f"{name or source.stem}{source.suffix}"
    dest = samples_dir / filename

    shutil.copy2(str(source), str(dest))

    _update_catalog(
        samples_dir,
        SampleInfo(
            name=name or source.stem,
            filename=filename,
            description=description,
            category=category,
        ),
    )

    return dest


def generate_test_samples(samples_dir: Path | None = None) -> list[Path]:
    """Generate basic synthetic test samples for development/testing.

    Creates simple synthesized audio files useful for testing effects
    without needing real vocal recordings.

    Returns:
        List of paths to generated files.
    """
    import numpy as np
    from voxmachinae.core.audio_io import AudioBuffer, save_audio

    if samples_dir is None:
        samples_dir = get_samples_dir(user_dir=False)

    generated: list[Path] = []
    sr = 44100

    # 1. Pure sine wave (A4 = 440Hz, 3 seconds)
    t = np.linspace(0, 3.0, int(3.0 * sr), endpoint=False)
    sine_440 = np.sin(2 * np.pi * 440 * t).astype(np.float32) * 0.8
    path = save_audio(
        AudioBuffer(sine_440, sr, "sine_440hz"),
        samples_dir / "sine_440hz.wav",
    )
    generated.append(path)

    # 2. Vibrato tone (simulates vocal vibrato)
    vibrato_rate = 5.5  # Hz
    vibrato_depth = 15  # cents
    freq_mod = 440 * 2 ** (vibrato_depth / 1200 * np.sin(2 * np.pi * vibrato_rate * t))
    phase = np.cumsum(2 * np.pi * freq_mod / sr)
    vibrato = np.sin(phase).astype(np.float32) * 0.8
    path = save_audio(
        AudioBuffer(vibrato, sr, "vibrato_tone"),
        samples_dir / "vibrato_tone.wav",
    )
    generated.append(path)

    # 3. Ascending scale (C4 to C5, quarter-second per note)
    notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
    scale_data = []
    for freq in notes:
        t_note = np.linspace(0, 0.4, int(0.4 * sr), endpoint=False)
        # Apply envelope to avoid clicks
        env = np.minimum(t_note / 0.02, 1.0) * np.minimum((0.4 - t_note) / 0.02, 1.0)
        note = np.sin(2 * np.pi * freq * t_note) * env
        scale_data.append(note)
    scale_audio = np.concatenate(scale_data).astype(np.float32) * 0.8
    path = save_audio(
        AudioBuffer(scale_audio, sr, "ascending_scale_c4_c5"),
        samples_dir / "ascending_scale_c4_c5.wav",
    )
    generated.append(path)

    # 4. Noise burst (for vocoder carrier testing)
    noise = np.random.randn(int(2.0 * sr)).astype(np.float32) * 0.3
    path = save_audio(
        AudioBuffer(noise, sr, "white_noise"),
        samples_dir / "white_noise.wav",
    )
    generated.append(path)

    # 5. Formant-like vowel synthesis (simplified)
    t = np.linspace(0, 2.0, int(2.0 * sr), endpoint=False)
    # Approximate "ah" vowel with harmonics
    fundamental = 150.0
    signal = np.zeros_like(t)
    for harmonic in range(1, 20):
        freq = fundamental * harmonic
        if freq > sr / 2:
            break
        # Rough formant shaping
        amp = 1.0 / harmonic
        if 500 < freq < 1200:
            amp *= 3.0  # First formant boost
        elif 2000 < freq < 3000:
            amp *= 2.0  # Second formant boost
        signal += amp * np.sin(2 * np.pi * freq * t)
    signal = (signal / np.abs(signal).max() * 0.7).astype(np.float32)
    path = save_audio(
        AudioBuffer(signal, sr, "synthetic_vowel_ah"),
        samples_dir / "synthetic_vowel_ah.wav",
    )
    generated.append(path)

    # Update catalog for all generated samples
    for p in generated:
        _update_catalog(
            samples_dir,
            SampleInfo(
                name=p.stem,
                filename=p.name,
                description=f"Synthetic test sample: {p.stem}",
                category="synthetic",
                sample_rate=sr,
                license="CC0",
                tags=["synthetic", "test"],
            ),
        )

    return generated


def _update_catalog(samples_dir: Path, info: SampleInfo) -> None:
    """Add or update a sample entry in the catalog.json."""
    catalog_path = samples_dir / "catalog.json"

    if catalog_path.exists():
        with open(catalog_path) as f:
            catalog = json.load(f)
    else:
        catalog = {"samples": []}

    # Remove existing entry with same name
    catalog["samples"] = [
        s for s in catalog["samples"] if s.get("name") != info.name
    ]

    # Add new entry
    from dataclasses import asdict
    catalog["samples"].append(asdict(info))

    with open(catalog_path, "w") as f:
        json.dump(catalog, f, indent=2)
