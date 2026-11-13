#!/bin/sh
# fake-flows.sh: Hubble-style dropped and forwarded flow rates per source and destination
# namespace, one "window" per cycle, pushed to the dev Pushgateway.
#
#   flow_rate{source_namespace, destination_namespace, source_group, verdict, window}  flows/s
set -eu

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
INTERVAL="${INTERVAL:-30}"
CYCLES="${CYCLES:-0}"

# source|group
SOURCES='frontend|apps
checkout|apps
payments|apps
catalog|apps
ingress|platform
monitoring|platform'
DESTS='frontend checkout payments catalog kube-system monitoring'

cycle=1
while :; do
  window="w-$(printf '%04d' "$cycle")"
  s=0
  echo "$SOURCES" | while IFS='|' read -r src group; do
    s=$((s + 1))
    body="# TYPE flow_rate gauge"
    d=0
    for dst in $DESTS; do
      d=$((d + 1))
      [ "$src" = "$dst" ] && continue
      fwd=$(awk -v s="$s" -v d="$d" -v c="$cycle" 'BEGIN { printf "%.3g", (s * 13 + d * 7) % 40 + 2 + ((c + s + d) % 3) }')
      # Drops: mostly near zero; checkout -> payments breaks every few windows.
      drop=$(awk -v s="$s" -v d="$d" -v c="$cycle" -v src="$src" -v dst="$dst" 'BEGIN {
        v = ((s + d + c) % 4) * 0.05
        if (src == "checkout" && dst == "payments") v = (c % 3 == 0) ? 0.1 : 3.2 + (c % 2)
        if (src == "ingress" && dst == "kube-system") v = 0.6 + (c % 2) * 0.4
        printf "%.3g", v }')
      l="source_namespace=\"$src\",destination_namespace=\"$dst\",source_group=\"$group\",window=\"$window\""
      body="$body
flow_rate{$l,verdict=\"forwarded\"} $fwd
flow_rate{$l,verdict=\"dropped\"} $drop"
    done
    printf '%s\n' "$body" | curl -fsS -X PUT --data-binary @- \
      "${PUSHGATEWAY_URL%/}/metrics/job/hubble_flows/source_namespace/$src" >/dev/null
  done
  echo "fake-flows: pushed $window"
  [ "$CYCLES" -ne 0 ] && [ "$cycle" -ge "$CYCLES" ] && break
  cycle=$((cycle + 1))
  sleep "$INTERVAL"
done
