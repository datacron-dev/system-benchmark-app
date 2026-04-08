#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  System Benchmark App — Start Script
#  Launches Next.js on http://localhost:8585
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=8585

cd "$PROJECT_DIR"

# Load nvm if available (in case Node was installed via nvm)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Ensure .env and SQLite database exist
if [ ! -f ".env" ] || ! grep -q "DATABASE_URL" ".env" 2>/dev/null; then
  echo 'DATABASE_URL="file:./data/benchmarks.db"' > .env
fi
mkdir -p prisma/data
if [ ! -f "prisma/data/benchmarks.db" ]; then
  echo "  Initializing database..."
  npx prisma generate 2>/dev/null || true
  npx prisma db push --accept-data-loss 2>/dev/null || true
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          System Benchmark App — Starting...              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Dashboard: http://localhost:$PORT"
echo "  Press Ctrl+C to stop"
echo ""

# Use production mode if .next build exists, otherwise dev
if [ -d "$PROJECT_DIR/.next" ] && [ -f "$PROJECT_DIR/.next/BUILD_ID" ]; then
  exec npm run start
else
  exec npm run dev
fi
