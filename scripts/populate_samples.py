#!/usr/bin/env python3
"""Populate the VoxMachina sample library.

Downloads free CC-licensed acapella samples from the web and optionally
generates vocal samples via the Kie AI / Suno API.

Usage:
    # Download free samples only
    python scripts/populate_samples.py --download

    # Generate samples via Suno API (requires KIE_API_KEY)
    python scripts/populate_samples.py --generate

    # Both
    python scripts/populate_samples.py --download --generate

    # Generate test (synthetic) samples
    python scripts/populate_samples.py --test
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


# ---------------------------------------------------------------------------
# Free sample sources (CC-licensed or public domain)
# ---------------------------------------------------------------------------

FREE_SAMPLES = [
    # --- Freesound CC-licensed samples (MP3 previews, no auth required) ---
    {
        "url": "https://cdn.freesound.org/previews/403/403908_7837954-hq.mp3",
        "name": "male_voice_sustained",
        "description": "Male loud singing voice from Freesound (befreezz)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "male", "sustained", "singing", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/451/451372_612689-hq.mp3",
        "name": "male_singing_feel_free",
        "description": "Male singing and chanting voice from Freesound (kyles)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "male", "singing", "chanting", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/315/315855_4557960-hq.mp3",
        "name": "female_vocal_long",
        "description": "Female sustained vocal with reverb from Freesound (bevibeldesign)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "female", "sustained", "reverb", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/669/669132_9959691-hq.mp3",
        "name": "foreboding_vocals_harmonized",
        "description": "Eerie vocal choir phrase from Freesound (Orboram)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "choir", "eerie", "harmony", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/572/572337_8323418-hq.mp3",
        "name": "spoken_word_male_deep",
        "description": "Deep male voice saying Attention from Freesound (Audeption)",
        "category": "speech",
        "license": "CC0-1.0",
        "tags": ["vocal", "male", "speech", "deep", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/255/255822_4756180-hq.mp3",
        "name": "speech_female_processed",
        "description": "Female speech sample with HPS model processing from Freesound (WantingChen)",
        "category": "speech",
        "license": "CC0-1.0",
        "tags": ["vocal", "female", "speech", "processed", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/639/639289_13590673-hq.mp3",
        "name": "vocal_percussion_beatbox",
        "description": "Beatbox vocal percussion from Freesound (Duisterwho)",
        "category": "beatbox",
        "license": "CC0-1.0",
        "tags": ["vocal", "beatbox", "percussion", "rhythm", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/666/666578_13884075-hq.mp3",
        "name": "choir_single_chord",
        "description": "Three voices overtone singing a major suspended chord from Freesound (Finnssound)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "choir", "chord", "overtone", "harmony", "freesound"],
    },
    # --- Freesound acapella samples (batch 2) ---
    {
        "url": "https://cdn.freesound.org/previews/362/362230_6644280-hq.mp3",
        "name": "male_acapella_storm",
        "description": "Male acapella vocal from Freesound (Paranoye)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "male", "acapella", "singing", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/643/643943_13590673-hq.mp3",
        "name": "rap_acapella_vocals",
        "description": "Rap acapella vocals in G Major from Freesound (Duisterwho)",
        "category": "rap",
        "license": "CC0-1.0",
        "tags": ["vocal", "rap", "hiphop", "acapella", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/464/464239_8472935-hq.mp3",
        "name": "male_scat_singing",
        "description": "Male scat singing, doo-wop style from Freesound (se2001)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "male", "scat", "jazz", "doowop", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/588/588566_5781159-hq.mp3",
        "name": "female_layered_wordless",
        "description": "Female wordless layered singing from Freesound (womb_affliction)",
        "category": "singing",
        "license": "CC-BY-4.0",
        "tags": ["vocal", "female", "layered", "wordless", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/835/835681_15551003-hq.mp3",
        "name": "spanish_latin_acapella",
        "description": "Latin America rock vocal sample at 89 BPM from Freesound (Billyguiro)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "spanish", "latin", "rock", "acapella", "freesound"],
    },
    # --- Freesound acapella samples (batch 3) ---
    {
        "url": "https://cdn.freesound.org/previews/93/93668_649468-hq.mp3",
        "name": "female_soul_acapella",
        "description": "Female soul vocalist warming up, unprocessed from Freesound (juskiddink)",
        "category": "singing",
        "license": "CC-BY-4.0",
        "tags": ["vocal", "female", "soul", "acapella", "warmup", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/555/555984_1690102-hq.mp3",
        "name": "female_vocal_csharp_sustained",
        "description": "Female sustained C# vocal note from Freesound (owstu)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "female", "sustained", "pitched", "csharp", "freesound"],
    },
    {
        "url": "https://cdn.freesound.org/previews/663/663189_3130497-hq.mp3",
        "name": "male_singing_note_vowels",
        "description": "Male singing vowels with hall reverb from Freesound (TheEndOfACycle)",
        "category": "singing",
        "license": "CC0-1.0",
        "tags": ["vocal", "male", "singing", "vowels", "reverb", "freesound"],
    },
]


def download_free_samples(samples_dir: Path) -> list[Path]:
    """Download free CC-licensed vocal samples."""
    from voxmachinae.utils.samples import download_sample

    downloaded: list[Path] = []

    for sample in FREE_SAMPLES:
        try:
            path = download_sample(
                url=sample["url"],
                name=sample["name"],
                category=sample["category"],
                description=sample["description"],
                license_info=sample["license"],
                user_dir=False,  # Save to package samples dir
            )
            print(f"  ✓ {sample['name']} -> {path}")
            downloaded.append(path)
        except Exception as e:
            print(f"  ✗ {sample['name']}: {e}")

    return downloaded


# ---------------------------------------------------------------------------
# Suno API generation
# ---------------------------------------------------------------------------

SUNO_GENERATION_REQUESTS = [
    {
        "prompt": "La la la, oh oh oh, singing free and clear, my voice rings out for all to hear",
        "style": "acapella, vocal, clean, pop",
        "title": "Clear Vocal Pop",
        "model": "v4",
        "description": "Clean pop vocal acapella generated via Suno",
        "tags": ["generated", "suno", "pop", "vocal"],
    },
    {
        "prompt": "Ooh, aah, yeah, feel the rhythm in your soul, let the music take control",
        "style": "acapella, r&b, soulful, vocal",
        "title": "Soulful R&B Vocal",
        "model": "v4",
        "description": "Soulful R&B vocal acapella generated via Suno",
        "tags": ["generated", "suno", "rnb", "soulful", "vocal"],
    },
    {
        "prompt": "Do do do, ba da ba, scatting through the night, everything's alright",
        "style": "acapella, jazz, scat, vocal",
        "title": "Jazz Scat Vocal",
        "model": "v4",
        "description": "Jazz scat vocal acapella generated via Suno",
        "tags": ["generated", "suno", "jazz", "scat", "vocal"],
    },
]


async def generate_suno_samples(samples_dir: Path) -> list[Path]:
    """Generate vocal samples via the Kie AI / Suno API."""
    from voxmachinae.ai.generative import (
        GenerationRequest,
        create_suno_client,
    )
    from voxmachinae.utils.samples import _update_catalog, SampleInfo

    api_key = os.environ.get("KIE_API_KEY", "")
    if not api_key:
        # Try loading from .env.local
        env_path = project_root / ".env.local"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("KIE_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not api_key:
        print("  ✗ No KIE_API_KEY found. Set it in .env.local or environment.")
        return []

    client = create_suno_client(api_key=api_key)
    generated: list[Path] = []

    for req_info in SUNO_GENERATION_REQUESTS:
        name = req_info["title"].lower().replace(" ", "_")
        dest = samples_dir / f"{name}.mp3"

        if dest.exists():
            print(f"  → {name} already exists, skipping")
            generated.append(dest)
            continue

        print(f"  ⏳ Generating: {req_info['title']}...")

        request = GenerationRequest(
            prompt=req_info["prompt"],
            style=req_info["style"],
            title=req_info["title"],
            instrumental=False,
            model=req_info["model"],
            custom_mode=True,
        )

        try:
            result = await client.generate_and_wait(
                request,
                timeout=300.0,
                poll_interval=10.0,
            )

            if result.status.value == "failed":
                print(f"  ✗ {name}: Generation failed — {result.error_message}")
                continue

            if not result.tracks:
                print(f"  ✗ {name}: No tracks returned")
                continue

            # Download the first track
            track = result.tracks[0]
            path = await client.download_track(
                track,
                output_dir=samples_dir,
                filename=f"{name}.mp3",
            )
            print(f"  ✓ {name} -> {path} ({track.duration:.1f}s)")
            generated.append(path)

            # Update catalog
            _update_catalog(
                samples_dir,
                SampleInfo(
                    name=name,
                    filename=f"{name}.mp3",
                    description=req_info["description"],
                    category="generated",
                    duration=track.duration,
                    sample_rate=44100,
                    license="Suno AI Generated",
                    source_url=track.audio_url,
                    tags=req_info["tags"],
                ),
            )

        except Exception as e:
            print(f"  ✗ {name}: {e}")

        # Small delay between generations to avoid rate limits
        await asyncio.sleep(2.0)

    return generated


def generate_test_samples(samples_dir: Path | None = None) -> list[Path]:
    """Generate synthetic test samples."""
    from voxmachinae.utils.samples import generate_test_samples as _gen

    return _gen(samples_dir)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Populate VoxMachina sample library")
    parser.add_argument("--download", action="store_true", help="Download free CC-licensed samples")
    parser.add_argument("--generate", action="store_true", help="Generate samples via Suno API")
    parser.add_argument("--test", action="store_true", help="Generate synthetic test samples")
    parser.add_argument("--all", action="store_true", help="Run all population methods")
    parser.add_argument("--dir", type=str, default=None, help="Custom samples directory")
    args = parser.parse_args()

    if not (args.download or args.generate or args.test or args.all):
        parser.print_help()
        return

    samples_dir = Path(args.dir) if args.dir else (project_root / "voxmachinae" / "samples")
    samples_dir.mkdir(parents=True, exist_ok=True)

    print(f"Sample library: {samples_dir}\n")

    if args.test or args.all:
        print("═══ Generating synthetic test samples ═══")
        paths = generate_test_samples(samples_dir)
        print(f"  Generated {len(paths)} test samples\n")

    if args.download or args.all:
        print("═══ Downloading free CC-licensed samples ═══")
        paths = download_free_samples(samples_dir)
        print(f"  Downloaded {len(paths)} samples\n")

    if args.generate or args.all:
        print("═══ Generating samples via Suno API ═══")
        paths = asyncio.run(generate_suno_samples(samples_dir))
        print(f"  Generated {len(paths)} samples\n")

    # Print summary
    catalog_path = samples_dir / "catalog.json"
    if catalog_path.exists():
        with open(catalog_path) as f:
            catalog = json.load(f)
        total = len(catalog.get("samples", []))
        print(f"═══ Library now contains {total} samples ═══")


if __name__ == "__main__":
    main()
