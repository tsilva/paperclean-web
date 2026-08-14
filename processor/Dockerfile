FROM ghcr.io/astral-sh/uv:0.8.13 AS uv
FROM python:3.13-slim

COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-editable

COPY src ./src
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    PAPERCLEAN_BACKEND=openrouter \
    PAPERCLEAN_JOBS=1 \
    PAPERCLEAN_MAX_ATTEMPTS=3

EXPOSE 8080
CMD ["python", "-m", "paperclean_processor"]
