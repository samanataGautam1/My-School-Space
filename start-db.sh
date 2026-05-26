#!/bin/bash
# Start Prisma Studio (Database GUI) on port 5555
DIR="$(cd "$(dirname "$0")" && pwd)"
lsof -ti:5555 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1
echo "Starting Prisma Studio on port 5555..."
cd "$DIR/backend" && npx prisma studio --port 5555
