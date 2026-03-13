"""VoxMachina: AI-assisted vocal modulation and orchestration for music production."""

__version__ = "0.1.0"

from voxmachinae.core.audio_io import AudioBuffer, load_audio, save_audio, record_audio
from voxmachinae.core.scales import Scale, detect_key
from voxmachinae.core.pitch import detect_pitch, PitchTrack

__all__ = [
    "AudioBuffer",
    "load_audio",
    "save_audio",
    "record_audio",
    "Scale",
    "detect_key",
    "detect_pitch",
    "PitchTrack",
]
