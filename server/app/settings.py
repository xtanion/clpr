"""Central runtime settings, read from the environment (12-factor style).

The LLM settings let gist generation run against either Anthropic or OpenAI without
code changes: set LLM_MODEL and, optionally, LLM_PROVIDER. If the provider is left
blank it is inferred from the model id (gpt-*/o-* -> openai, claude-* -> anthropic).
"""

from __future__ import annotations

import os


def provider_for(model: str) -> str:
    """Infer the API provider from a model id."""
    m = model.lower()
    if m.startswith(("gpt", "o1", "o3", "o4", "chatgpt")):
        return "openai"
    return "anthropic"


# --- LLM (gist generation) ---
LLM_MODEL = os.environ.get("LLM_MODEL", "claude-opus-4-8")
LLM_PROVIDER = (os.environ.get("LLM_PROVIDER", "").strip().lower() or provider_for(LLM_MODEL))

# --- gists ---
GIST_EVAL_THRESHOLD = float(os.environ.get("GIST_EVAL_THRESHOLD", "0.6"))

# Ingest API auth (server side). Empty = /api/admin/gists endpoints disabled.
GIST_ADMIN_TOKEN = os.environ.get("GIST_ADMIN_TOKEN", "").strip()

# Default remote target for the local build's --push (client side).
GIST_PUSH_URL = os.environ.get("GIST_PUSH_URL", "").rstrip("/")
