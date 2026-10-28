#!/bin/sh
# Install Ledgerline on this computer and start it.
#   curl -fsSL https://raw.githubusercontent.com/Devanshgoel-123/ledgerline/main/install.sh | sh
# Installs into ~/ledgerline (set LEDGERLINE_DIR to choose another folder).
# Read it first if you like: it downloads the source, then runs ./ledgerline start.

set -eu

REPO_URL="https://github.com/Devanshgoel-123/ledgerline"
DIR="${LEDGERLINE_DIR:-$HOME/ledgerline}"

fail() {
  printf '✗ %s\n' "$1" >&2
  shift
  for line in "$@"; do printf '  %s\n' "$line" >&2; done
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "Docker is not installed." \
  "Ledgerline runs inside Docker. Install it first, then run this again:" \
  "  macOS / Windows: Docker Desktop  https://docs.docker.com/desktop/" \
  "  Linux:           Docker Engine   https://docs.docker.com/engine/install/" \
  "On Windows, run this in a WSL (Ubuntu) terminal with Docker Desktop's WSL integration on."

if [ -x "$DIR/ledgerline" ]; then
  printf 'Ledgerline is already installed in %s. Starting it.\n' "$DIR"
  exec "$DIR/ledgerline" start
fi

if [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  fail "$DIR already exists and is not empty." "Choose another folder: LEDGERLINE_DIR=/path/to/folder sh install.sh"
fi

printf '==> Downloading Ledgerline into %s\n' "$DIR"
if command -v git >/dev/null 2>&1; then
  git clone --depth 1 "$REPO_URL.git" "$DIR"
else
  mkdir -p "$DIR"
  curl -fsSL "$REPO_URL/archive/refs/heads/main.tar.gz" | tar -xz -C "$DIR" --strip-components 1
fi

chmod +x "$DIR/ledgerline"
printf '==> Installed. Next time, open a terminal and run: cd %s && ./ledgerline start\n' "$DIR"
exec "$DIR/ledgerline" start
