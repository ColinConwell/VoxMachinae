# DSP Glossary

A reference guide to digital signal processing concepts used throughout Vox Machina.

---

## Pitch & Frequency

**Fundamental Frequency (F0)**
:   The lowest frequency component of a periodic sound wave, perceived as the pitch of the sound. For human speech, F0 typically ranges from 85 Hz (low male voice) to 300 Hz (high female voice).

**Semitone**
:   The smallest interval in Western music. One octave contains 12 semitones. A semitone corresponds to a frequency ratio of 2^(1/12) ≈ 1.0595.

**Cent**
:   A unit of pitch equal to 1/100th of a semitone. Used for fine-grained pitch measurement. 1200 cents = 1 octave.

**Pitch Detection**
:   The process of estimating the fundamental frequency of a sound over time. Common algorithms include YIN, pYIN (probabilistic YIN), and CREPE (a CNN-based detector).

**pYIN**
:   Probabilistic YIN — a pitch detection algorithm that extends YIN with a hidden Markov model for improved accuracy and voiced/unvoiced classification. Used as the default detector in Vox Machina.

**CREPE**
:   A convolutional neural network trained on synthesized data to predict pitch. More accurate than traditional methods but slower. Available in model sizes from "tiny" to "full".

---

## Auto-Tune

**Pitch Correction**
:   The process of adjusting a vocal performance's pitch to match the nearest note in a musical scale. Can range from subtle correction (natural sound) to aggressive quantization (robotic effect).

**Retune Speed**
:   How quickly the pitch correction snaps to the target note. Fast retune speed (0-10ms) creates the characteristic "T-Pain" or "Cher" effect. Slow retune speed (50-100ms) sounds more natural.

**Humanize**
:   A parameter that preserves natural pitch variation (vibrato, glides) on sustained notes while still correcting the overall pitch center. Higher values = more natural.

**Flex-Tune / Tolerance**
:   A threshold that determines how far a note must be from the target before correction kicks in. Notes already close to pitch are left alone, preserving natural expressiveness.

**Formant Correction**
:   Preserving the spectral envelope (formants) of the voice while shifting pitch, preventing the "chipmunk" or "Darth Vader" effect that occurs with naive pitch shifting.

---

## Vocoder

**Vocoder (Voice Encoder)**
:   A device that imposes the spectral characteristics of one signal (the modulator, typically voice) onto another signal (the carrier, typically a synthesizer). Creates the classic "robot voice" or "talking synthesizer" effect.

**Modulator**
:   The input signal whose spectral envelope is analyzed — usually a human voice. The modulator controls *what* is being said.

**Carrier**
:   The signal whose timbre is shaped by the modulator's spectral envelope — usually a sawtooth or chord from a synthesizer. The carrier controls *how* it sounds.

**Channel Vocoder**
:   A vocoder that splits the signal into frequency bands (channels) using a filter bank, extracts the amplitude envelope of each band from the modulator, and applies those envelopes to the corresponding bands of the carrier.

**Phase Vocoder**
:   An STFT-based technique that performs cross-synthesis in the frequency domain. Can also be used for time-stretching and spectral freezing.

**LPC Vocoder (Linear Predictive Coding)**
:   Analyzes speech using a linear prediction model to extract formant frequencies and residual excitation. The classic "robot voice" from early speech synthesis.

**Filter Bank**
:   A set of bandpass filters that divide a signal into frequency bands. In a channel vocoder, the number and spacing of bands determines the "resolution" of the voice encoding.

**Envelope Follower**
:   A circuit or algorithm that tracks the amplitude envelope of a signal over time. In a vocoder, envelope followers extract the volume contour of each frequency band.

---

## Effects

**Reverb (Reverberation)**
:   The persistence of sound after the original source has stopped, caused by reflections in an enclosed space. Digitally simulated using convolution or algorithmic methods.

**Room Size**
:   Controls the simulated size of the reverberant space. Larger values = longer reverb tail.

**Damping**
:   How quickly high frequencies decay in the reverb tail. Higher damping = darker, more natural-sounding reverb.

**Wet/Dry Mix**
:   The ratio between the processed (wet) signal and the original (dry) signal. 0% = fully dry, 100% = fully wet.

**Delay (Echo)**
:   A time-based effect that plays back a copy of the signal after a set time interval. Multiple repetitions with decreasing volume create an echo trail.

**Feedback**
:   In a delay effect, the proportion of the delayed signal that is fed back into the input. Higher feedback = more repetitions. Values near 1.0 create infinite echo.

**Formant**
:   Resonant frequencies of the vocal tract that give each vowel its characteristic sound. Formant shifting changes the perceived size/character of the voice without changing pitch.

---

## Spectral Analysis

**STFT (Short-Time Fourier Transform)**
:   A technique that computes the frequency content of a signal in short overlapping windows, producing a time-frequency representation (spectrogram).

**Spectrogram**
:   A visual representation of the frequency content of a signal over time. The x-axis is time, y-axis is frequency, and color/brightness represents amplitude.

**FFT (Fast Fourier Transform)**
:   An efficient algorithm for computing the discrete Fourier transform, converting a time-domain signal to its frequency-domain representation.

**Window Function**
:   A function applied to each analysis frame before FFT to reduce spectral leakage. Common windows: Hann, Hamming, Blackman.

**Hop Length**
:   The number of samples between successive STFT frames. Smaller hop = higher time resolution but more computation.

---

## Stem Separation

**Source Separation**
:   The process of isolating individual sound sources (vocals, drums, bass, etc.) from a mixed audio signal. Modern approaches use deep neural networks.

**Demucs**
:   Meta's neural network architecture for music source separation. Demucs v4 (Hybrid Transformer) achieves state-of-the-art separation quality.

**Stems**
:   Individual audio tracks separated from a mix. Standard stems: vocals, drums, bass, other (instruments).

---

## Audio Fundamentals

**Sample Rate**
:   The number of amplitude samples per second in a digital audio signal. CD quality = 44,100 Hz. Common rates: 22050, 44100, 48000 Hz.

**Nyquist Frequency**
:   Half the sample rate — the maximum frequency that can be represented in a digital signal. For 44.1 kHz audio, Nyquist = 22.05 kHz.

**Bit Depth**
:   The number of bits used to represent each audio sample. Higher bit depth = larger dynamic range. CD = 16-bit, professional = 24-bit, float = 32-bit.

**LUFS (Loudness Units Full Scale)**
:   A standardized loudness measurement that accounts for human hearing perception. Used for loudness normalization. Streaming targets: -14 to -16 LUFS.

**Spectral Gating**
:   A noise reduction technique that suppresses frequency components below a threshold, estimated from a noise profile. Effective for stationary noise (hiss, hum).

**Dynamic Range**
:   The ratio between the loudest and quietest parts of an audio signal, typically measured in decibels (dB).
