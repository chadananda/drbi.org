#!/usr/bin/env bash
# pre-deploy.sh — gate that must pass before any production deploy
# Usage: BASE_URL=https://your-preview.workers.dev bash scripts/pre-deploy.sh
# Exits 0 on full pass, 1 if any check fails.

BASE_URL="${BASE_URL:-https://drbi-preview.chadananda.workers.dev}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=================================="
echo " DRBI Pre-Deploy Test Gate"
echo " Target: $BASE_URL"
echo "=================================="
echo ""

UNIT_PASS=0
UNIT_FAIL=0
BDD_EXIT=0

# --- [1] Unit tests ---
echo "[1/2] Unit Tests"
echo ""
cd "$PROJECT_DIR"
for test_file in tests/unit/*.test.js; do
  name="$(basename "$test_file")"
  if node --test "$test_file" > /dev/null 2>&1; then
    echo "  PASS  $name"
    UNIT_PASS=$((UNIT_PASS + 1))
  else
    echo "  FAIL  $name"
    UNIT_FAIL=$((UNIT_FAIL + 1))
  fi
done
echo ""
echo "  Unit tests: $UNIT_PASS passed, $UNIT_FAIL failed"
if [ "$UNIT_FAIL" -gt 0 ]; then
  echo "  NOTE: Unit test failures detected — check for pre-existing issues"
fi

# --- [2] BDD Smoke + Critical suite (excluding known bugs) ---
echo ""
echo "[2/2] BDD Smoke/Critical Suite (against $BASE_URL)"
echo ""
BASE_URL="$BASE_URL" npx cucumber-js \
  "tests/features/**/*.feature" \
  --import "tests/step-definitions/**/*.js" \
  --import "tests/support/**/*.js" \
  --tags "(@smoke or @critical) and not @known-bug" \
  --format summary
BDD_EXIT=$?

echo ""
echo "=================================="
if [ "$BDD_EXIT" -eq 0 ] && [ "$UNIT_FAIL" -eq 0 ]; then
  echo " Results: PASS — all checks passed"
  echo " STATUS: safe to deploy"
  exit 0
elif [ "$BDD_EXIT" -ne 0 ]; then
  echo " Results: FAIL — BDD smoke/critical tests failed (deploy blocked)"
  if [ "$UNIT_FAIL" -gt 0 ]; then
    echo "          Also: $UNIT_FAIL unit test file(s) failing (pre-existing)"
  fi
  echo " STATUS: FAIL"
  exit 1
else
  echo " Results: WARN — BDD passed but $UNIT_FAIL unit test file(s) failing"
  echo " STATUS: BDD gate PASS, unit failures need investigation"
  exit 1
fi
