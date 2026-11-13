#!/bin/sh
# fake-checks.sh: OAT-style acceptance checks per image (a base -> dependent tree), one run per
# cycle, pushed to the dev Pushgateway.
#
#   image_check_value{image, base_image, check, run_id}
#   checks: startup_seconds, image_size_mb, cve_high (lower is better), smoke_pass_ratio (higher)
set -eu

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
INTERVAL="${INTERVAL:-30}"
CYCLES="${CYCLES:-0}"

# image|base|startup|size|cve_high|smoke
IMAGES='debian-slim|-|0.8|74|3|1
python|debian-slim|1.6|152|4|1
api|python|2.4|210|4|0.98
worker|python|2.1|198|5|1
alpine|-|0.3|8|0|1
nginx|alpine|0.5|47|1|1
redis|alpine|0.6|41|0|1'

cycle=1
while :; do
  run="build-$(printf '%04d' "$cycle")"
  echo "$IMAGES" | while IFS='|' read -r image base startup size cve smoke; do
    [ "$base" = "-" ] && base=""
    # api's startup regresses on odd builds; worker's image grows; nginx gets a CVE fix.
    vals=$(awk -v c="$cycle" -v img="$image" -v st="$startup" -v sz="$size" -v cv="$cve" -v sm="$smoke" 'BEGIN {
      if (img == "api" && c % 2 == 1) st = st * 1.35
      if (img == "worker") sz = sz + (c % 3) * 6
      if (img == "nginx" && c % 2 == 0) cv = 0
      if (img == "api" && c % 3 == 0) sm = 0.94
      printf "%.3g %.4g %d %.3g", st * (1 + (c % 3 - 1) * 0.01), sz, cv, sm }')
    set -- $vals
    l="image=\"$image\",base_image=\"$base\",run_id=\"$run\""
    printf '# TYPE image_check_value gauge
image_check_value{%s,check="startup_seconds"} %s
image_check_value{%s,check="image_size_mb"} %s
image_check_value{%s,check="cve_high"} %s
image_check_value{%s,check="smoke_pass_ratio"} %s
' "$l" "$1" "$l" "$2" "$l" "$3" "$l" "$4" | curl -fsS -X PUT --data-binary @- \
      "${PUSHGATEWAY_URL%/}/metrics/job/image_checks/image/$image" >/dev/null
  done
  echo "fake-checks: pushed $run"
  [ "$CYCLES" -ne 0 ] && [ "$cycle" -ge "$CYCLES" ] && break
  cycle=$((cycle + 1))
  sleep "$INTERVAL"
done
