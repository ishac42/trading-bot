# ── Stage 1: Build dependencies ──────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --gid 1000 appuser && \
    useradd --uid 1000 --gid appuser --shell /bin/bash appuser

COPY --from=builder /install /usr/local

COPY alembic.ini .
COPY alembic/ alembic/
COPY app/ app/
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
