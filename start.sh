#!/bin/bash
# ================================================================
#   SCHOOL SPACE — Start All Servers
#   Usage: ./start.sh
# ================================================================

echo ""
echo "  ┌─────────────────────────────────────┐"
echo "  │       SCHOOL SPACE — Starting        │"
echo "  └─────────────────────────────────────┘"
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill any existing processes on our ports
lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:5555 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Start Backend
echo "  [1/3] Starting Backend (port 8080)..."
cd "$DIR/backend" && npm run dev &
BACKEND_PID=$!
sleep 2

# Start Prisma Studio
echo "  [2/3] Starting Prisma Studio (port 5555)..."
cd "$DIR/backend" && npx prisma studio --port 5555 &>/dev/null &
STUDIO_PID=$!

# Start Frontend
echo "  [3/3] Starting Frontend (port 3000)..."
cd "$DIR/frontend" && npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo "  ┌─────────────────────────────────────┐"
echo "  │         All Servers Running          │"
echo "  ├─────────────────────────────────────┤"
echo "  │  Frontend:     http://localhost:3000 │"
echo "  │  Backend API:  http://localhost:8080 │"
echo "  │  Database GUI: http://localhost:5555 │"
echo "  ├─────────────────────────────────────┤"
echo "  │  Press Ctrl+C to stop all servers    │"
echo "  └─────────────────────────────────────┘"
echo ""

# Wait and handle Ctrl+C
cleanup() {
    echo ""
    echo "  Stopping all servers..."
    kill $BACKEND_PID $STUDIO_PID $FRONTEND_PID 2>/dev/null
    lsof -ti:8080 -ti:3000 -ti:5555 2>/dev/null | xargs kill -9 2>/dev/null
    echo "  All servers stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM
wait
