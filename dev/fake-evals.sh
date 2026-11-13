#!/bin/sh
# fake-evals.sh: plays an LLM eval pipeline against the dev Pushgateway, through eval-push.sh.
# Every cycle is a new run for each model and prompt version; scores move a little per cycle.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
PUSH="$HERE/eval-push.sh"
INTERVAL="${INTERVAL:-30}"
CYCLES="${CYCLES:-0}" # 0 runs forever

# model|prompt|faithfulness|answer_relevance|toxicity|latency_p95_seconds|cost_per_case_usd|cases
MODELS='reference|v1|0.82|0.78|0.012|1.40|0.0042|500
model-a|v2|0.86|0.80|0.011|1.45|0.0040|500
model-a|v3|0.84|0.83|0.018|1.10|0.0039|480
model-b|v1|0.75|0.77|0.012|2.30|0.0021|500
small-model|v1|0.70|0.71|0.025|0.60|0.0006|450
small-model|v2|0.73|0.74|0.013|0.62|0.0007|450'

# jitter VALUE CYCLE SEED: VALUE moved by -2 % to +2 %, deterministic per cycle and seed.
jitter() {
  awk -v v="$1" -v c="$2" -v s="$3" 'BEGIN { printf "%.4g", v * (1 + 0.01 * (((c * 7 + s * 3) % 5) - 2)) }'
}

cycle=1
while :; do
  i=0
  echo "$MODELS" | while IFS='|' read -r model prompt faith rel tox lat cost cases; do
    i=$((i + 1))
    "$PUSH" push --model "$model" --prompt-version "$prompt" \
      --run-id "eval-$(printf '%04d' "$cycle")" --cases "$((cases - (cycle * i) % 20))" \
      faithfulness="$(jitter "$faith" "$cycle" "$i")" \
      answer_relevance="$(jitter "$rel" "$cycle" $((i + 1)))" \
      toxicity="$(jitter "$tox" "$cycle" $((i + 2)))" \
      latency_p95_seconds="$(jitter "$lat" "$cycle" $((i + 3)))" \
      cost_per_case_usd="$(jitter "$cost" "$cycle" $((i + 4)))"
  done
  echo "fake-evals: pushed run eval-$(printf '%04d' "$cycle")"
  [ "$CYCLES" -ne 0 ] && [ "$cycle" -ge "$CYCLES" ] && break
  cycle=$((cycle + 1))
  sleep "$INTERVAL"
done
