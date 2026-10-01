#!/bin/sh
# Apply pending Prisma migrations, then start the API.
# Migration failure is non-fatal (warn + continue) so a transient DB
# blip doesn't boot-loop the container; the app will error visibly instead.
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node dist/server.js
