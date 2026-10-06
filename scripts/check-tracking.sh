#!/usr/bin/env bash
# Tracking install gate — section 1 of the Measurement & Tracking Specification.
#
# Checks the three things that are invisible until someone looks, and expensive
# once they are live:
#
#   1. No analytics or pixel code is hard-coded in a template. A second copy of
#      GA4 or the Meta pixel double-counts every conversion, and Google Ads
#      then bids against numbers that are twice what really happened.
#   2. The container appears exactly twice: the loader and the <noscript>
#      fallback. Three means two containers; one means the fallback was lost.
#   3. The order in the <head>: consent defaults, then page metadata, then the
#      container. Consent Mode only works if the default state exists before
#      any Google tag reads it, and the sensitive-page rules only work if
#      page_sensitivity is already in the dataLayer when the first tags fire.
#
# Byte offsets rather than line numbers, because the server renders a page as
# one line.
#
# Usage: scripts/check-tracking.sh URL [URL …]
#   GTM_ID unset  — only the "nothing hard-coded" check runs, and says so.
#   GTM_ID set    — all three run.

set -uo pipefail

GTM_ID="${GTM_ID:-}"
FAILED=0

if [[ $# -eq 0 ]]; then
  echo "usage: $0 URL [URL …]" >&2
  exit 2
fi

if [[ -z "$GTM_ID" ]]; then
  echo "note: GTM_ID is not set, so only the 'no hard-coded tags' check runs."
  echo "      Set it once the container exists to gate the install as well."
  echo
fi

for URL in "$@"; do
  H=$(curl -fsS --max-time 30 "$URL" 2>/dev/null) || { echo "FAIL $URL (request failed)"; FAILED=1; continue; }

  # 1. Nothing hard-coded. Always checked.
  DIRECT=$(grep -oE "gtag/js\?id=G-|fbevents\.js|clarity\.ms/tag|connect\.facebook\.net|hotjar" <<<"$H" | wc -l | tr -d ' ')
  if [[ "$DIRECT" -ne 0 ]]; then
    echo "FAIL $URL — $DIRECT tracking script(s) hard-coded in the page; everything goes through the container"
    FAILED=1
    continue
  fi

  if [[ -z "$GTM_ID" ]]; then
    echo "PASS $URL (no hard-coded tags)"
    continue
  fi

  # 2. The container, exactly twice.
  COUNT=$(grep -o "$GTM_ID" <<<"$H" | wc -l | tr -d ' ')
  if [[ "$COUNT" -ne 2 ]]; then
    echo "FAIL $URL — container appears $COUNT time(s), expected 2 (loader + noscript)"
    FAILED=1
    continue
  fi

  # 3. Order: consent defaults -> page metadata -> container.
  C=$(grep -obE "[\"']consent[\"'] *, *[\"']default[\"']" <<<"$H" | head -1 | cut -d: -f1)
  M=$(grep -obE "[\"']page_sensitivity[\"']" <<<"$H" | head -1 | cut -d: -f1)
  G=$(grep -ob "googletagmanager.com/gtm.js" <<<"$H" | head -1 | cut -d: -f1)

  if [[ -z "$C" ]]; then echo "FAIL $URL — no consent defaults block"; FAILED=1; continue; fi
  if [[ -z "$M" ]]; then echo "FAIL $URL — no page metadata push (page_sensitivity missing)"; FAILED=1; continue; fi
  if [[ -z "$G" ]]; then echo "FAIL $URL — container loader not found"; FAILED=1; continue; fi

  if (( C < M && M < G )); then
    echo "PASS $URL"
  else
    echo "FAIL $URL — wrong order in <head> (consent@$C, metadata@$M, container@$G)"
    FAILED=1
  fi
done

exit "$FAILED"
