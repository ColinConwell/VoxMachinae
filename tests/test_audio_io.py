from __future__ import annotations

import numpy as np

from voxmachinae.core.audio_io import AudioBuffer


def test_resample_preserves_stereo_channels() -> None:
    left = np.sin(np.linspace(0, np.pi * 2, 1024, dtype=np.float32))
    right = np.cos(np.linspace(0, np.pi * 2, 1024, dtype=np.float32))
    stereo = np.stack([left, right], axis=-1)

    buffer = AudioBuffer(data=stereo, sample_rate=48_000, name="stereo")
    resampled = buffer.resample(24_000)

    assert resampled.channels == 2
    assert resampled.sample_rate == 24_000
    assert resampled.data.ndim == 2
    assert resampled.data.shape[1] == 2
    assert not np.allclose(resampled.data[:, 0], resampled.data[:, 1])
