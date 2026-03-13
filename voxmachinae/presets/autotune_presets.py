"""Built-in auto-tune presets for common vocal styles."""

from voxmachinae.core.autotune import AutoTuneParams

AUTOTUNE_PRESETS: dict[str, AutoTuneParams] = {
    "natural": AutoTuneParams(
        retune_speed=80.0,
        humanize=60.0,
        formant_correction=True,
        flex_tune=40.0,
    ),
    "pop": AutoTuneParams(
        retune_speed=20.0,
        humanize=30.0,
        formant_correction=True,
        flex_tune=50.0,
    ),
    "t_pain": AutoTuneParams(
        retune_speed=0.0,
        humanize=0.0,
        formant_correction=True,
        flex_tune=50.0,
    ),
    "cher": AutoTuneParams(
        retune_speed=0.0,
        humanize=0.0,
        formant_correction=False,
        flex_tune=50.0,
    ),
    "robotic": AutoTuneParams(
        retune_speed=0.0,
        humanize=0.0,
        formant_correction=False,
        flex_tune=100.0,
        scale_type="chromatic",
    ),
    "subtle": AutoTuneParams(
        retune_speed=200.0,
        humanize=80.0,
        formant_correction=True,
        flex_tune=25.0,
    ),
    "off": AutoTuneParams(
        retune_speed=400.0,
        humanize=100.0,
        flex_tune=0.0,
    ),
}


def get_autotune_preset(name: str, key: str = "C", scale_type: str = "chromatic") -> AutoTuneParams:
    """Get a named auto-tune preset with the specified key and scale."""
    if name not in AUTOTUNE_PRESETS:
        raise ValueError(f"Unknown preset: {name!r}. Available: {list(AUTOTUNE_PRESETS.keys())}")
    import copy
    params = copy.copy(AUTOTUNE_PRESETS[name])
    params.key = key
    if params.scale_type == "chromatic" and scale_type != "chromatic":
        params.scale_type = scale_type
    return params
