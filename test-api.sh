#!/bin/bash

# =========================================================
# Bun AI API Load Balancer — Test Script
# Usage: ./test-api.sh [API_URL]
# Example: API_URL=http://localhost:8080 ./test-api.sh
# =========================================================

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="${1:-${API_URL:-http://localhost:8080}}"
PASS=0
FAIL=0

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Bun AI API Load Balancer — Test Suite      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo -e "${CYAN}  Target URL: ${API_URL}${NC}"
if [ -n "$TARGET_SERVICE" ]; then
  echo -e "${CYAN}  Target Service: ${TARGET_SERVICE}${NC}"
fi
echo ""

# ── Helper: run a test ────────────────────────────────────
run_test() {
  local num="$1"
  local label="$2"
  local response="$3"
  local expect_success="$4"   # "true" or "false" or "" (skip check)

  echo -e "${GREEN}── Test ${num}: ${label}${NC}"

  if [ -z "$response" ]; then
    echo -e "  ${RED}✗ No response received (is the server running?)${NC}"
    ((FAIL++))
    echo ""
    return
  fi

  # Pretty-print JSON if possible
  echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"

  if [ -n "$expect_success" ]; then
    local actual
    actual=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(d.get('success','n/a')).lower())" 2>/dev/null)
    if [ "$actual" = "$expect_success" ]; then
      echo -e "  ${GREEN}✓ success=${actual}${NC}"
      ((PASS++))
    else
      echo -e "  ${RED}✗ Expected success=${expect_success}, got: ${actual}${NC}"
      ((FAIL++))
    fi
  fi
  echo ""
}

# ── Test 1: Health Check ──────────────────────────────────
echo -e "${YELLOW}[ INFRASTRUCTURE TESTS ]${NC}\n"

response=$(curl -s --max-time 10 "${API_URL}/")
run_test 1 "Health Check (GET /)" "$response"

# ── Test 2: 404 Unknown route ─────────────────────────────
response=$(curl -s --max-time 10 "${API_URL}/unknown-route")
run_test 2 "Unknown Route → 404" "$response"

# ── Test 3: Invalid body (missing messages) ───────────────
response=$(curl -s --max-time 10 -X POST "${API_URL}/chat/complete" \
  -H "Content-Type: application/json" \
  -d '{}')
run_test 3 "Missing 'messages' field → 400" "$response"

# ── Test 4: Empty messages array ─────────────────────────
response=$(curl -s --max-time 10 -X POST "${API_URL}/chat/complete" \
  -H "Content-Type: application/json" \
  -d '{"messages":[]}')
run_test 4 "Empty messages array → 400" "$response"

# ── Test 5: Invalid role ──────────────────────────────────
response=$(curl -s --max-time 10 -X POST "${API_URL}/chat/complete" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"admin","content":"hi"}]}')
run_test 5 "Invalid role → 400" "$response"

# ── AI Service round-robin tests ──────────────────────────
echo -e "${YELLOW}[ AI SERVICE TESTS — round-robin ]${NC}\n"

# Get active services from health endpoint
active_services=$(curl -s --max-time 5 "${API_URL}/" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); [print(s) for s in d.get('activeServices',[])]" 2>/dev/null)

if [ -z "$active_services" ]; then
  echo -e "${RED}  ✗ Could not retrieve active services from health endpoint${NC}\n"
else
  echo -e "  ${CYAN}Active services detected:${NC}"
  echo "$active_services" | while IFS= read -r svc; do
    echo -e "    • $svc"
  done
  echo ""
fi

# Cycle through complete requests or run a targeted one
if [ -n "$TARGET_SERVICE" ]; then
  REQUESTS=2 # just do a couple for the targeted service
else
  NUM_SERVICES=$(echo "$active_services" | grep -c .)
  REQUESTS=$(( NUM_SERVICES > 0 ? NUM_SERVICES * 2 : 6 ))
fi

for i in $(seq 1 $REQUESTS); do
  test_num=$((5 + i))
  # Build JSON conditionally to avoid trailing commas
  if [ -n "$TARGET_SERVICE" ]; then
    payload="{\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK #${i}\"}],\"targetService\":\"${TARGET_SERVICE}\"}"
  else
    payload="{\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK #${i}\"}]}"
  fi

  response=$(curl -s --max-time 30 -X POST "${API_URL}/chat/complete" \
    -H "Content-Type: application/json" \
    -d "$payload")
  run_test "$test_num" "Complete chat #${i}" "$response" "true"
done

# ── Test: Streaming endpoint ──────────────────────────────
echo -e "${YELLOW}[ STREAMING TEST ]${NC}\n"
echo -e "${GREEN}── Test $((5 + REQUESTS + 1)): Streaming Chat (POST /chat/stream)${NC}"
echo -e "  ${CYAN}Streaming output:${NC}"
  if [ -n "$TARGET_SERVICE" ]; then
    payload="{\"messages\":[{\"role\":\"user\",\"content\":\"Count from 1 to 3, briefly\"}],\"targetService\":\"${TARGET_SERVICE}\"}"
  else
    payload="{\"messages\":[{\"role\":\"user\",\"content\":\"Count from 1 to 3, briefly\"}]}"
  fi

stream_output=$(curl -s --max-time 30 -X POST "${API_URL}/chat/stream" \
  -H "Content-Type: application/json" \
  -d "$payload")
if [ -n "$stream_output" ]; then
  echo -e "  ${GREEN}✓ Stream received:${NC} ${stream_output:0:120}..."
  ((PASS++))
else
  echo -e "  ${RED}✗ No stream output${NC}"
  ((FAIL++))
fi
echo ""

# ── Summary ───────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  RESULTS                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo -e "  Total  : ${TOTAL}"
echo -e "  ${GREEN}Passed : ${PASS}${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Failed : ${FAIL}${NC}"
else
  echo -e "  Failed : 0"
fi

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n  ${GREEN}✓ All tests passed!${NC}\n"
  exit 0
else
  echo -e "\n  ${RED}✗ ${FAIL} test(s) failed.${NC}\n"
  exit 1
fi
