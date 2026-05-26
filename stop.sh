#!/bin/bash
# Stop all School Space servers
echo "Stopping all servers..."
lsof -ti:8080 -ti:3000 -ti:5555 2>/dev/null | xargs kill -9 2>/dev/null
echo "All servers stopped."
