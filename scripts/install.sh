#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  System Benchmark App — Installer
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/datacron-dev/system-benchmark-app/main/scripts/install.sh | bash
# ──────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/datacron-dev/system-benchmark-app.git"
REPO_NAME="system-benchmark-app"
INSTALL_DIR="${INSTALL_DIR:-$HOME/$REPO_NAME}"
REQUIRED_NODE_MAJOR=18
PORT=8585
FIRST_INSTALL=false

# ── Colors ────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          System Benchmark App — Installer                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Clone or force-update ─────────────────────────────────
echo -e "${CYAN}[1/7]${NC} Setting up repository..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  ${YELLOW}→${NC} Repo exists. Force-updating to latest..."
  cd "$INSTALL_DIR"
  git fetch --all
  git reset --hard origin/main
  git clean -fd
else
  FIRST_INSTALL=true
  echo -e "  ${GREEN}→${NC} Cloning repository..."
  git clone --depth=1 "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
echo -e "  ${GREEN}✓${NC} Repository ready at $INSTALL_DIR"

# ── 2. Check & auto-update Node.js ──────────────────────────
echo -e "${CYAN}[2/7]${NC} Checking Node.js..."

install_node_via_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # Install nvm if not present
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo -e "  ${YELLOW}→${NC} Installing nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  echo -e "  ${YELLOW}→${NC} Installing Node.js 20 LTS via nvm..."
  nvm install 20
  nvm use 20
  nvm alias default 20
}

need_node_upgrade=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$REQUIRED_NODE_MAJOR" ]; then
    echo -e "  ${YELLOW}⚠${NC} Node.js v${NODE_VER} found — v${REQUIRED_NODE_MAJOR}+ required"
    need_node_upgrade=true
  else
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v) found"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Node.js not found"
  need_node_upgrade=true
fi

if [ "$need_node_upgrade" = true ]; then
  install_node_via_nvm
fi

echo -e "  ${GREEN}✓${NC} Node.js $(node -v) | npm $(npm -v)"

# ── 3. Install dependencies ─────────────────────────────────
echo -e "${CYAN}[3/7]${NC} Installing npm dependencies..."
cd "$INSTALL_DIR"
npm install --legacy-peer-deps 2>&1 | tail -3
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# ── 4. Prisma setup (SQLite — zero config) ────────────────
echo -e "${CYAN}[4/7]${NC} Setting up database..."
cd "$INSTALL_DIR"

# Ensure .env exists with SQLite DATABASE_URL
if [ ! -f ".env" ] || ! grep -q "DATABASE_URL" ".env" 2>/dev/null; then
  echo 'DATABASE_URL="file:./data/benchmarks.db"' > .env
  echo -e "  ${GREEN}→${NC} Created .env with SQLite database"
fi

# Ensure prisma/data directory exists
mkdir -p prisma/data

# Generate Prisma client and push schema to SQLite
echo -e "  ${GREEN}→${NC} Generating Prisma client..."
npx prisma generate 2>&1 | tail -2 || {
  echo -e "  ${RED}✗${NC} Prisma generate failed"
}
echo -e "  ${GREEN}→${NC} Initializing database..."
npx prisma db push --accept-data-loss 2>&1 | tail -2 || {
  echo -e "  ${RED}✗${NC} Prisma db push failed"
}
echo -e "  ${GREEN}✓${NC} SQLite database ready"

# ── 5. Create desktop launcher ───────────────────────────────
echo -e "${CYAN}[5/7]${NC} Creating desktop launcher..."
PROJECT_DIR="$INSTALL_DIR"
START_SH="$PROJECT_DIR/scripts/start.sh"
SVG_ICON="$PROJECT_DIR/public/favicon.svg"
PNG_ICON="$HOME/.local/share/icons/system-benchmark-64.png"
DESKTOP_FILE="$HOME/Desktop/System_Benchmark.desktop"

chmod +x "$START_SH" 2>/dev/null || true

# Create PNG fallback from SVG
mkdir -p "$(dirname "$PNG_ICON")"
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 64 -h 64 "$SVG_ICON" -o "$PNG_ICON" 2>/dev/null || true
elif command -v convert &>/dev/null; then
  convert "$SVG_ICON" -resize 64x64 "$PNG_ICON" 2>/dev/null || true
fi

ICON_PATH="$SVG_ICON"
[ -f "$PNG_ICON" ] && ICON_PATH="$PNG_ICON"

mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications"

cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=System Benchmark
Comment=Stress-test local LLM inference with real-time monitoring
Exec=bash -c "cd '$PROJECT_DIR' && (sleep 3 && xdg-open http://localhost:$PORT &) && ./scripts/start.sh"
Icon=$ICON_PATH
Terminal=true
Categories=Development;System;
StartupNotify=true
DESKTOP

chmod +x "$DESKTOP_FILE"
cp -f "$DESKTOP_FILE" "$HOME/.local/share/applications/"
echo -e "  ${GREEN}✓${NC} Desktop shortcut created"

# ── 6. Build (optional, speeds up first start) ──────────────
echo -e "${CYAN}[6/7]${NC} Pre-building app..."
cd "$INSTALL_DIR"
npm run build 2>&1 | tail -5 || {
  echo -e "  ${YELLOW}⚠${NC} Build had warnings — app will still work in dev mode"
}
echo -e "  ${GREEN}✓${NC} Build complete"

# ── 7. Done ──────────────────────────────────────────────────
echo -e "${CYAN}[7/7]${NC} Installation complete!"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       System Benchmark App installed successfully!       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start:     ${CYAN}cd $INSTALL_DIR && ./scripts/start.sh${NC}"
echo -e "  Dashboard: ${CYAN}http://localhost:$PORT${NC}"
echo -e "  Desktop:   Click ${CYAN}System Benchmark${NC} icon on your desktop"
echo ""

# Auto-start browser on first install
if [ "$FIRST_INSTALL" = true ]; then
  echo -e "  ${GREEN}→${NC} First install detected — launching app now..."
  cd "$INSTALL_DIR"
  (sleep 4 && xdg-open "http://localhost:$PORT" 2>/dev/null || true) &
  exec ./scripts/start.sh
fi
