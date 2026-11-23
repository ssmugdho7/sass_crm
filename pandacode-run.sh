#!/bin/sh
# pandacode-preview: http://127.0.0.1:3010
set -e
cd "$(dirname "$0")"
[ -f apps/api/database/database.sqlite ] || (cd apps/api && touch database/database.sqlite && php artisan migrate --seed --force)
(cd apps/api && php artisan migrate --force -q && php artisan modules:sync -q && php artisan storage:link -q 2>/dev/null || true)
(cd apps/api && php artisan serve --host=127.0.0.1 --port=8010) &
API_PID=$!
(cd apps/api && php artisan queue:work --quiet) &
QUEUE_PID=$!
trap 'kill $API_PID $QUEUE_PID 2>/dev/null' EXIT INT TERM
cd apps/web && API_URL=http://127.0.0.1:8010 npm run dev -- --hostname 127.0.0.1 --port 3010
