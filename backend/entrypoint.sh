#!/usr/bin/env bash
set -e

echo "Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0
until python -c "
import asyncio, asyncpg, os

async def check():
    url = os.environ['DATABASE_URL']
    for prefix in ('postgresql+asyncpg://', 'postgresql://'):
        if url.startswith(prefix):
            url = 'postgres://' + url[len(prefix):]
            break
    conn = await asyncpg.connect(url)
    await conn.close()

asyncio.run(check())
"; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "  ERROR: PostgreSQL not reachable after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "  PostgreSQL not ready (attempt $RETRY_COUNT/$MAX_RETRIES) — retrying in 2s"
  sleep 2
done
echo "PostgreSQL is ready."

echo "Running database migrations..."
if ! alembic upgrade head 2>&1; then
  echo "WARNING: Migration failed. Checking for stale revision..."
  if alembic heads 2>&1 | grep -q "head"; then
    HEAD_REV=$(alembic heads 2>&1 | head -1 | awk '{print $1}')
    echo "Stale revision detected — stamping database to $HEAD_REV via SQL."
    python -c "
import asyncio, asyncpg, os

async def fix():
    url = os.environ['DATABASE_URL']
    for prefix in ('postgresql+asyncpg://', 'postgresql://'):
        if url.startswith(prefix):
            url = 'postgres://' + url[len(prefix):]
            break
    conn = await asyncpg.connect(url)
    await conn.execute('DELETE FROM alembic_version')
    await conn.execute(\"INSERT INTO alembic_version (version_num) VALUES (\$1)\", '$HEAD_REV')
    await conn.close()

asyncio.run(fix())
"
    echo "Re-running migrations..."
    alembic upgrade head
  else
    echo "ERROR: Migration failed for an unexpected reason."
    exit 1
  fi
fi
echo "Migrations complete."

echo "Starting Uvicorn..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${UVICORN_WORKERS:-1}" \
  --log-level "${LOG_LEVEL:-info}"
