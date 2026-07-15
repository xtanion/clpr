# FastAPI backend image, built with uv. Deployed as a Render "Docker" web service.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

# Install dependencies first for layer caching (lockfile only, no app code yet).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# App source.
COPY app ./app

# Render injects $PORT; default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
