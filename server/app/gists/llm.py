"""LLM provider abstraction for gist generation.

Two operations are needed: a structured `parse` (extract the canonical knowledge and
run the eval, into pydantic schemas) and free-text `generate` (the reading modes).
Anthropic and OpenAI implement the same small interface, so build.py is provider-
agnostic and the choice is a settings/env flag.

Provider-specific niceties degrade gracefully: Anthropic uses adaptive thinking +
effort and prompt-caches the shared IR across the sibling mode calls; OpenAI ignores
those knobs (it caches automatically) and just gets the equivalent messages.
"""

from __future__ import annotations

from typing import Type, TypeVar

import anthropic
import openai
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

# Errors worth skipping a single concept over (not a bug in our code).
API_ERRORS = (anthropic.APIError, openai.OpenAIError)


class LLMClient:
    provider: str
    model: str

    def parse(self, system: str, user: str, schema: Type[T], *, max_tokens: int, effort: str = "medium") -> T:
        raise NotImplementedError

    def generate(self, system_parts: list[str], user: str, *, max_tokens: int) -> str:
        raise NotImplementedError


class AnthropicClient(LLMClient):
    provider = "anthropic"

    def __init__(self, model: str):
        self.model = model
        self._c = anthropic.Anthropic()

    def parse(self, system, user, schema, *, max_tokens, effort="medium"):
        resp = self._c.messages.parse(
            model=self.model,
            max_tokens=max_tokens,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        return resp.parsed_output

    def generate(self, system_parts, user, *, max_tokens):
        blocks = []
        for i, text in enumerate(system_parts):
            block = {"type": "text", "text": text}
            # Cache the last block (the shared IR) so it isn't re-billed across the
            # five mode calls; a no-op below the model's cache minimum.
            if len(system_parts) > 1 and i == len(system_parts) - 1:
                block["cache_control"] = {"type": "ephemeral"}
            blocks.append(block)
        resp = self._c.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=blocks,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in resp.content if b.type == "text").strip()


class OpenAIClient(LLMClient):
    provider = "openai"

    def __init__(self, model: str):
        self.model = model
        self._c = openai.OpenAI()

    def parse(self, system, user, schema, *, max_tokens, effort="medium"):
        resp = self._c.beta.chat.completions.parse(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format=schema,
        )
        parsed = resp.choices[0].message.parsed
        if parsed is None:
            raise openai.OpenAIError("model returned no parsed output (possible refusal)")
        return parsed

    def generate(self, system_parts, user, *, max_tokens):
        system = "\n\n".join(system_parts)
        resp = self._c.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        return (resp.choices[0].message.content or "").strip()


def make_client(provider: str, model: str) -> LLMClient:
    if provider == "anthropic":
        return AnthropicClient(model)
    if provider == "openai":
        return OpenAIClient(model)
    raise ValueError(f"unknown LLM provider '{provider}' (use 'anthropic' or 'openai')")
