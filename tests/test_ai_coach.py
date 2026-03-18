from __future__ import annotations

from voxmachinae.ai.agents import coach


def test_extract_suggestions_filters_unknown_params() -> None:
    content = """
```json
{
  "retune_speed": 32,
  "humanize": 12,
  "delete_all_sessions": true
}
```
"""
    suggestions = coach._extract_suggestions(content)
    assert len(suggestions) == 1
    params = suggestions[0]["params"]
    assert "retune_speed" in params
    assert "humanize" in params
    assert "delete_all_sessions" not in params


def test_validate_effect_params_clamps_values() -> None:
    normalized = coach._validate_effect_params(
        {
            "wet": 2.0,
            "feedback": 1.2,
            "n_bands": 200,
            "shift_semitones": -40,
        }
    )
    assert normalized is not None
    assert normalized["wet"] == 1.0
    assert normalized["feedback"] == 0.99
    assert normalized["n_bands"] == 64
    assert normalized["shift_semitones"] == -24.0


async def test_chat_rejects_empty_message() -> None:
    response = await coach.chat(message="   ")
    assert response.model_used == "validation"
    assert "non-empty" in response.content.lower()
