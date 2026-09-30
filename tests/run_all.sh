#!/usr/bin/env bash
# Runs every PyNoCode check:
#   1. browser unit checks + generation of every design/toolkit/layout/structure,
#   2. UI interaction checks with real mouse and keyboard input,
#   3. execution of every generated program with real tkinter / customtkinter.
#
# Needs: Node with the `playwright` package and Chromium, Python 3 with tkinter,
# `pip install customtkinter pyflakes`, and a display (xvfb-run is used if none).
# Set PYTHON to choose the interpreter (default: python3).
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python3}"
OUT="tests/.out"

node tests/generate_cases.js "$OUT"
node tests/ui_checks.js

if [ -n "${DISPLAY:-}" ]; then
  "$PYTHON" tests/run_generated.py "$OUT"
else
  xvfb-run -a -s "-screen 0 1920x1080x24" "$PYTHON" tests/run_generated.py "$OUT"
fi
