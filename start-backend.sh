#!/bin/bash
# Start Backend only (port 8080)
DIR="$(cd "$(dirname "$0")" && pwd)"
lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1
echo "Starting Backend on port 8080..."
cd "$DIR/backend" && npm run dev
