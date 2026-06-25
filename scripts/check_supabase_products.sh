#!/usr/bin/env bash
# scripts/check_supabase_products.sh
#
# Verifies that products exist in Supabase for the demo business.
# Use this to confirm the teammate dataset is in place before running
# DATA_MODE=supabase demos.
#
# Usage:
#   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bash scripts/check_supabase_products.sh
#   # or set vars in .env and run via: source .env && bash scripts/check_supabase_products.sh
#
# Fails (exit 1) if no products are returned.

set -euo pipefail

BUSINESS_ID="${BUSINESS_ID:-demo_luna_bakery}"

# ── Check required env vars ───────────────────────────────────────────────────
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "❌  SUPABASE_URL is not set."
  echo "    Set it in .env or export it before running this script."
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "❌  SUPABASE_SERVICE_ROLE_KEY is not set."
  echo "    Set it in .env or export it before running this script."
  exit 1
fi

KEY_PREFIX="${SUPABASE_SERVICE_ROLE_KEY:0:6}"
echo "──────────────────────────────────────────────────────────────────"
echo "  Supabase Products Check"
echo "  URL: ${SUPABASE_URL}"
echo "  Key: ${KEY_PREFIX}... (truncated)"
echo "  Business: ${BUSINESS_ID}"
echo "──────────────────────────────────────────────────────────────────"

# ── Query the products table ──────────────────────────────────────────────────
HTTP_STATUS=$(curl -s -o /tmp/mp_products_response.json -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/products?business_id=eq.${BUSINESS_ID}&select=id,name,price_gbp,available" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Accept: application/json")

if [[ "${HTTP_STATUS}" != "200" ]]; then
  echo "❌  Supabase returned HTTP ${HTTP_STATUS}"
  cat /tmp/mp_products_response.json
  exit 1
fi

# ── Parse with python3 (jq may not be available) ──────────────────────────────
python3 - <<'PYEOF'
import json, sys

with open("/tmp/mp_products_response.json") as f:
    data = json.load(f)

if not isinstance(data, list):
    print("❌  Unexpected response shape:", data)
    sys.exit(1)

count = len(data)
print(f"  Product count: {count}")

if count == 0:
    print("")
    print("❌  No products found for this business_id.")
    print("    Run the seed SQL in supabase/seed.sql to populate products.")
    sys.exit(1)

print("")
print("  Products:")
for p in data:
    status = "✓" if p.get("available") else "✗"
    print(f"    [{status}] {p.get('id','')} — {p.get('name','')}  £{p.get('price_gbp','?')}")

print("")
print("✅  Supabase products check passed.")
PYEOF
