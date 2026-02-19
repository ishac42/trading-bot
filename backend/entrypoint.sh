#!/usr/bin/env bash
set -e

echo "Waiting for PostgreSQL..."
until python -c "
import asyncio, asyncpg, os

async def check():
    url = os.environ['DATABASE_URL'].replace('+asyncpg', '')
    conn = await asyncpg.connect(url)
    await conn.close()

asyncio.run(check())
" 2>/dev/null; do
  echo "  PostgreSQL not ready — retrying in 2s"
  sleep 2
done
echo "PostgreSQL is ready."

echo "Running database migrations..."
alembic upgrade head
echo "Migrations complete."

echo "Starting Uvicorn..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${UVICORN_WORKERS:-1}" \
  --log-level "${LOG_LEVEL:-info}"
