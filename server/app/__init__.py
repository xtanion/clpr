"""clpr backend package.

Load server/.env into the process environment on import — before any submodule
reads os.environ (auth.py and settings.py read it at import time), so `uv run
uvicorn app.main:app` and `uv run python -m app.gists.build` both pick it up
without an --env-file flag. No-op if the file is absent (in production the
platform injects env vars), and existing environment variables are never
overridden.
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
