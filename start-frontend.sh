#!/bin/bash
# Start Frontend only (port 3000)
DIR="$(cd "$(dirname "$0")" && pwd)"
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1
echo "Starting Frontend on port 3000..."
cd "$DIR/frontend" && npm run dev
