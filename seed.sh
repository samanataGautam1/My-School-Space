#!/bin/bash
# Seed the database with demo data
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Seeding database..."
cd "$DIR/backend" && node prisma/seed.js
