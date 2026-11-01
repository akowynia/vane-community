#!/bin/sh
set -e

# Ensure data and uploads directories exist and have proper permissions for vane-community user
DATA_DIR_PATH="${DATA_DIR:-/home/vane-community/data}"
UPLOADS_DIR_PATH="/home/vane-community/uploads"

mkdir -p "$DATA_DIR_PATH" "$UPLOADS_DIR_PATH" 2>/dev/null || true
chown -R vane-community:vane-community "$DATA_DIR_PATH" "$UPLOADS_DIR_PATH" 2>/dev/null || true
chmod 775 "$DATA_DIR_PATH" "$UPLOADS_DIR_PATH" 2>/dev/null || true

echo "Starting SearXNG..."

# Initialize persistent SearXNG configuration in data volume
DATA_SETTINGS="/home/vane-community/data/searxng-settings.yml"
ETC_SETTINGS="/etc/searxng/settings.yml"

if [ -f "$DATA_SETTINGS" ]; then
  echo "Loading persistent SearXNG configuration from $DATA_SETTINGS..."
  cp "$DATA_SETTINGS" "$ETC_SETTINGS"
elif [ -f "$ETC_SETTINGS" ]; then
  echo "Initializing persistent SearXNG configuration to $DATA_SETTINGS..."
  cp "$ETC_SETTINGS" "$DATA_SETTINGS" 2>/dev/null || true
  chmod 664 "$DATA_SETTINGS" 2>/dev/null || true
  chown vane-community:vane-community "$DATA_SETTINGS" 2>/dev/null || true
fi

export SEARXNG_SETTINGS_PATH="$ETC_SETTINGS"
export FLASK_APP=searx/webapp.py

# Run uWSGI / SearXNG under searxng user in the background
gosu searxng /usr/local/searxng/searx-pyenv/bin/uwsgi \
  --http-socket 0.0.0.0:8080 \
  --ini /etc/searxng/uwsgi.ini &
SEARXNG_PID=$!

echo "Waiting for SearXNG to be ready..."

COUNTER=0
MAX_TRIES=30
until curl -f -s -H "X-Forwarded-For: 127.0.0.1" -H "X-Real-IP: 127.0.0.1" http://127.0.0.1:8080/ > /dev/null 2>&1; do
  COUNTER=$((COUNTER+1))
  if [ $COUNTER -ge $MAX_TRIES ]; then
    echo "Warning: SearXNG health check timeout, but continuing..."
    break
  fi
  sleep 1
done

if curl -f -s -H "X-Forwarded-For: 127.0.0.1" -H "X-Real-IP: 127.0.0.1" http://127.0.0.1:8080/ > /dev/null 2>&1; then
  echo "SearXNG started successfully (PID: $SEARXNG_PID)"
else
  echo "SearXNG may not be fully ready, but continuing (PID: $SEARXNG_PID)"
fi

cd /home/vane-community
echo "Starting Vane-Community..."

exec gosu vane-community node server.js