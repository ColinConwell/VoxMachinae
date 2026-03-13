"""Preset configurations for vocoder effects.

Provides ready-to-use parameter sets for channel, phase, and LPC vocoders,
inspired by classic hardware and iconic vocal processing styles.
"""

from voxmachinae.core.vocoder import (
    ChannelVocoderParams,
    PhaseVocoderParams,
    LPCVocoderParams,
)

CHANNEL_VOCODER_PRESETS: dict[str, ChannelVocoderParams] = {
    "daft_punk": ChannelVocoderParams(
        n_bands=24,
        band_spacing="log",
        carrier_type="saw",
        carrier_freq=100.0,
        envelope_attack=5.0,
        envelope_release=15.0,
        sibilance=0.2,
    ),
    "kraftwerk": ChannelVocoderParams(
        n_bands=16,
        band_spacing="linear",
        carrier_type="square",
        carrier_freq=110.0,
        envelope_attack=3.0,
        envelope_release=10.0,
        sibilance=0.1,
    ),
    "talkbox": ChannelVocoderParams(
        n_bands=32,
        band_spacing="log",
        carrier_type="saw",
        carrier_freq=80.0,
        envelope_attack=2.0,
        envelope_release=8.0,
        sibilance=0.4,
    ),
    "warm": ChannelVocoderParams(
        n_bands=12,
        band_spacing="log",
        carrier_type="sine",
        carrier_freq=110.0,
        envelope_attack=10.0,
        envelope_release=30.0,
        sibilance=0.15,
    ),
    "harsh": ChannelVocoderParams(
        n_bands=32,
        band_spacing="linear",
        carrier_type="pulse",
        carrier_freq=80.0,
        envelope_attack=1.0,
        envelope_release=5.0,
        sibilance=0.5,
    ),
}

PHASE_VOCODER_PRESETS: dict[str, PhaseVocoderParams] = {
    "robot": PhaseVocoderParams(robotize=True),
    "whisper": PhaseVocoderParams(whisperize=True),
    "freeze": PhaseVocoderParams(freeze=True),
}

LPC_VOCODER_PRESETS: dict[str, LPCVocoderParams] = {
    "classic_robot": LPCVocoderParams(order=16, carrier_type="noise"),
    "radio": LPCVocoderParams(order=10, carrier_type="saw"),
    "alien": LPCVocoderParams(order=24, carrier_type="square"),
}
