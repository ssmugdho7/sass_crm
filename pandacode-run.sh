#!/bin/sh
# pandacode-preview: http://127.0.0.1:3000
set -e
cd "$(dirname "$0")"
[ -f apps/api/database/database.sqlite ] || (cd apps/api && touch database/database.sqlite && php artisan migrate --seed --force)
(cd apps/api && php artisan serve --host=127.0.0.1 --port=8000) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT INT TERM
cd apps/web && API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
