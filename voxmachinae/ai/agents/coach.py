"""AI Coach agent for teaching audio production concepts.

Uses LiteLLM for model-agnostic LLM access. The Coach agent:
- Explains what effects do and how they work
- Teaches DSP concepts (pitch detection, vocoders, formants, etc.)
- Suggests parameter values for specific sounds
- Provides learning paths for beginners

Falls back to Anthropic SDK if LiteLLM features are insufficient.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


SYSTEM_PROMPTS = {
    "coach": """You are VoxMachinae Coach — a friendly, knowledgeable audio production teacher.

Your role:
- Explain DSP concepts clearly with analogies and examples
- Teach how auto-tune, vocoders, reverb, delay, formant shifting, and denoising work
- Suggest specific parameter values when users want to achieve a particular sound
- Reference real-world examples (artists, songs, eras) to contextualize effects
- Be encouraging and progressive — start simple, build complexity

Available effects in VoxMachinae:
1. Auto-Tune: Pitch correction with key/scale, retune speed, humanize, formant correction
2. Vocoder: Channel vocoder (Daft Punk), Phase vocoder (robotic), LPC vocoder (classic robot)
3. Reverb: Schroeder reverb with room size, damping, wet/dry
4. Delay: Feedback delay with delay time, feedback, wet/dry
5. Formant Shift: WORLD vocoder-based formant shifting (-12 to +12 semitones)
6. Denoise: Spectral gate noise reduction, speech enhancement, silence removal

When suggesting parameters, format them as JSON objects that the user can apply directly.
Keep responses concise (2-4 short paragraphs). Use markdown for formatting.""",

    "producer": """You are VoxMachinae Producer — a creative music production consultant.

Your role:
- Suggest creative vocal processing chains and effect combinations
- Recommend specific parameter values for achieving desired sounds
- Draw from knowledge of music genres, iconic sounds, and modern production
- Help users create unique vocal textures and effects
- Suggest generative music prompts for backing tracks

When suggesting effect chains, provide them as ordered steps with specific parameters.
Format parameter suggestions as JSON objects.
Be creative, inspiring, and specific. Reference artists and techniques.
Keep responses focused and actionable (2-4 paragraphs).""",

    "mixer": """You are VoxMachinae Mixer — an analytical audio mixing engineer.

Your role:
- Analyze audio characteristics and recommend optimal settings
- Suggest auto-tune settings based on pitch analysis data
- Recommend reverb/delay parameters based on the audio content
- Optimize vocoder settings for intelligibility and character
- Provide technical mixing advice

When you have audio analysis data (pitch, spectral info), use it to make specific
parameter recommendations formatted as JSON objects.
Be precise, technical, and data-driven. Keep responses concise.""",
}


@dataclass
class AgentResponse:
    """Response from an AI agent."""

    content: str
    suggestions: list[dict[str, Any]] = field(default_factory=list)
    model_used: str = ""
    tokens_used: int = 0


@dataclass
class AudioContext:
    """Context about the current audio session for the agent."""

    duration: float = 0.0
    sample_rate: int = 44100
    detected_key: str = ""
    detected_scale: str = ""
    pitch_confidence: float = 0.0
    rms_level: float = 0.0
    active_effects: list[str] = field(default_factory=list)


async def chat(
    message: str,
    agent_mode: str = "coach",
    history: list[dict[str, str]] | None = None,
    audio_context: AudioContext | None = None,
    model: str = "anthropic/claude-sonnet-4-20250514",
) -> AgentResponse:
    """Send a message to an AI agent and get a response.

    Uses LiteLLM for model-agnostic access. Falls back gracefully
    if LiteLLM is not installed.

    Args:
        message: User's message.
        agent_mode: One of "coach", "producer", "mixer".
        history: Previous conversation messages.
        audio_context: Information about the current audio session.
        model: LiteLLM model identifier.

    Returns:
        AgentResponse with the agent's reply and any suggestions.
    """
    system_prompt = SYSTEM_PROMPTS.get(agent_mode, SYSTEM_PROMPTS["coach"])

    # Add audio context if available
    if audio_context:
        context_str = "\n\nCurrent audio context:"
        if audio_context.duration > 0:
            context_str += f"\n- Duration: {audio_context.duration:.1f}s"
        if audio_context.detected_key:
            context_str += f"\n- Detected key: {audio_context.detected_key} {audio_context.detected_scale}"
            context_str += f" (confidence: {audio_context.pitch_confidence:.0%})"
        if audio_context.active_effects:
            context_str += f"\n- Active effects: {', '.join(audio_context.active_effects)}"
        system_prompt += context_str

    messages = [{"role": "system", "content": system_prompt}]

    if history:
        messages.extend(history[-10:])  # Keep last 10 messages

    messages.append({"role": "user", "content": message})

    try:
        import litellm

        response = await litellm.acompletion(
            model=model,
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )

        content = response.choices[0].message.content or ""
        tokens = getattr(response.usage, "total_tokens", 0) if response.usage else 0

        # Parse suggestions from the response
        suggestions = _extract_suggestions(content)

        return AgentResponse(
            content=content,
            suggestions=suggestions,
            model_used=model,
            tokens_used=tokens,
        )

    except ImportError:
        logger.warning("LiteLLM not installed, falling back to basic response")
        return AgentResponse(
            content=_fallback_response(message, agent_mode),
            model_used="fallback",
        )
    except Exception as exc:
        logger.exception("AI agent error")
        return AgentResponse(
            content=f"I encountered an issue: {exc}. Try again or check your API keys.",
            model_used="error",
        )


def _extract_suggestions(content: str) -> list[dict[str, Any]]:
    """Extract parameter suggestions from agent response text.

    Looks for JSON blocks in the response that represent effect parameters.
    """
    import json
    import re

    suggestions = []

    # Find JSON code blocks
    json_blocks = re.findall(r"```(?:json)?\s*(\{[^`]+\})\s*```", content, re.DOTALL)

    for block in json_blocks:
        try:
            data = json.loads(block)
            if isinstance(data, dict):
                # Try to identify the effect type from the keys
                effect = "unknown"
                if "retune_speed" in data or "key" in data:
                    effect = "autotune"
                elif "n_bands" in data or "carrier_type" in data:
                    effect = "vocoder"
                elif "room_size" in data or "damping" in data:
                    effect = "reverb"
                elif "delay_time" in data or "feedback" in data:
                    effect = "delay"
                elif "shift_semitones" in data:
                    effect = "formant"

                suggestions.append({
                    "label": f"Apply {effect} settings",
                    "effect": effect,
                    "params": data,
                })
        except json.JSONDecodeError:
            continue

    return suggestions


def _fallback_response(message: str, agent_mode: str) -> str:
    """Provide a basic response when LLM is unavailable."""
    msg_lower = message.lower()

    if "auto-tune" in msg_lower or "autotune" in msg_lower:
        return (
            "Auto-tune works by detecting the pitch of your voice and correcting it "
            "to the nearest note in a musical scale. The key parameters are:\n\n"
            "- **Retune Speed**: How fast the correction happens. 0 = instant (robotic), "
            "higher values = more natural\n"
            "- **Key & Scale**: Which notes to correct to\n"
            "- **Humanize**: Preserves natural vibrato on sustained notes\n\n"
            "For the classic T-Pain effect, use retune speed 0 with chromatic scale. "
            "For natural correction, try retune speed 50-100ms."
        )

    if "vocoder" in msg_lower:
        return (
            "A vocoder analyzes the spectral shape of your voice (the modulator) and "
            "applies it to a synthesized sound (the carrier). This creates the classic "
            "robot voice or Daft Punk sound.\n\n"
            "VoxMachinae has three types:\n"
            "- **Channel Vocoder**: Classic analog-style, best for Daft Punk sounds\n"
            "- **Phase Vocoder**: STFT-based, good for robotic and whispery effects\n"
            "- **LPC Vocoder**: Linear prediction, classic 1980s robot voice"
        )

    return (
        "I'm the VoxMachinae AI assistant. I can help you with:\n\n"
        "- Understanding how effects work (auto-tune, vocoder, reverb, etc.)\n"
        "- Suggesting parameter settings for specific sounds\n"
        "- Creative vocal processing ideas\n\n"
        "Try asking me about a specific effect or describe the sound you want to create! "
        "(Note: Full AI responses require LiteLLM + an API key.)"
    )
