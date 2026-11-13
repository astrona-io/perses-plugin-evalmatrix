#!/bin/sh
# eval-push.sh: reference pusher for the LLM eval metric contract (docs/metrics.md).
#
# Pushes one eval run of one model and prompt version to a Prometheus Pushgateway. POSIX sh plus
# curl, base64, sed and tr: runs in alpine, busybox, curlimages/curl and every common CI runner.
#
#   eval-push.sh push   --model M --prompt-version P --run-id R [--cases N] METRIC=VALUE ...
#   eval-push.sh forget --model M --prompt-version P
#
#   eval-push.sh push --model gpt-x --prompt-version v3 --run-id "$GITHUB_RUN_ID" --cases 500 \
#     faithfulness=0.86 answer_relevance=0.81 toxicity=0.011 latency_p95_seconds=1.42
#
# Environment:
#   PUSHGATEWAY_URL   default http://localhost:9091
#   EVAL_JOB          job label of the pushed groups, default "llm_eval"
#   CURL_OPTS         extra curl options, e.g. "--cacert /etc/ssl/ca.pem" or "-u user:pass"
#
# Grouping key: job=<EVAL_JOB>, model, prompt_version. A new run replaces the previous run of the
# same model and prompt version in the gateway; Prometheus keeps the history, so the panel can
# compare a run with the one before it.
set -eu

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
EVAL_JOB="${EVAL_JOB:-llm_eval}"
CURL_OPTS="${CURL_OPTS:-}"

die() {
  echo "eval-push: $*" >&2
  exit 2
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

# Label values in the text exposition format: escape backslash, double quote and newline.
esc() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'NR>1{printf "\\n"} {printf "%s", $0}'
}

# Grouping key values go in the URL path as base64url, so "/" in model names is safe.
b64() {
  if [ -z "$1" ]; then
    printf '='
  else
    printf '%s' "$1" | base64 | tr -d '\n=' | tr '+/' '-_'
  fi
}

group_url() {
  printf '%s/metrics/job@base64/%s/model@base64/%s/prompt_version@base64/%s' \
    "${PUSHGATEWAY_URL%/}" "$(b64 "$EVAL_JOB")" "$(b64 "$1")" "$(b64 "$2")"
}

[ $# -ge 1 ] || usage
cmd="$1"
shift

model="" prompt="" run_id="" cases=""
while [ $# -gt 0 ]; do
  case "$1" in
    --model | --prompt-version | --run-id | --cases)
      [ $# -ge 2 ] || die "missing value for $1"
      case "$1" in
        --model) model="$2" ;;
        --prompt-version) prompt="$2" ;;
        --run-id) run_id="$2" ;;
        --cases) cases="$2" ;;
      esac
      shift 2
      ;;
    --*) die "unknown option $1" ;;
    *) break ;;
  esac
done

[ -n "$model" ] || die "--model is required"
[ -n "$prompt" ] || die "--prompt-version is required"

case "$cmd" in
  push)
    [ -n "$run_id" ] || die "push needs --run-id"
    [ $# -ge 1 ] || die "push needs at least one METRIC=VALUE"
    ids="model=\"$(esc "$model")\",prompt_version=\"$(esc "$prompt")\",run_id=\"$(esc "$run_id")\""
    body="# TYPE llm_eval_score gauge"
    for pair in "$@"; do
      metric="${pair%%=*}"
      value="${pair#*=}"
      [ -n "$metric" ] && [ "$metric" != "$pair" ] || die "scores are METRIC=VALUE, got $pair"
      body="$body
llm_eval_score{$ids,metric=\"$(esc "$metric")\"} $value"
    done
    if [ -n "$cases" ]; then
      body="$body
# TYPE llm_eval_cases_total gauge
llm_eval_cases_total{$ids} $cases"
    fi
    # shellcheck disable=SC2086
    printf '%s\n' "$body" | curl -fsS $CURL_OPTS -X PUT --data-binary @- "$(group_url "$model" "$prompt")" >/dev/null
    ;;
  forget)
    # shellcheck disable=SC2086
    curl -fsS $CURL_OPTS -X DELETE "$(group_url "$model" "$prompt")" >/dev/null
    ;;
  -h | --help | help) usage ;;
  *) die "unknown command $cmd (push, forget)" ;;
esac
