# Metrics

`EvalMatrixChart` reads any time series with labels: `rowLabels` pick the row, `columnLabel` the
column, `runLabel` the run. This page defines the LLM eval contract the demo uses, with a reference
pusher, and the two other demo shapes.

## LLM evals

| Metric                 | Type  | Labels                                        | Value                         |
| ---------------------- | ----- | --------------------------------------------- | ----------------------------- |
| `llm_eval_score`       | gauge | `model`, `prompt_version`, `metric`, `run_id` | the metric's score in the run |
| `llm_eval_cases_total` | gauge | `model`, `prompt_version`, `run_id`           | eval cases the run scored     |

- `metric` is the eval metric: `faithfulness`, `answer_relevance`, `toxicity`,
  `latency_p95_seconds`, `cost_per_case_usd` or any other. Use base units (seconds, not ms; a 0-1
  ratio, not a percentage) and let the column `format` display them.
- `run_id` is unique per run, for example the CI run id. Keep it short; it is shown in the panel.
- `llm_eval_cases_total` is optional. Without it the detail strip shows no sample size.
- Do not add per-case labels (case id, prompt text): one series per run and metric is enough, and
  anything finer belongs in the eval store that `cellLink` points to.

Panel queries and options:

```yaml
queries:
  - llm_eval_score # query 0
  - llm_eval_cases_total # query 1, sampleSizeQuery: 1
spec:
  rowLabels: [model, prompt_version]
  columnLabel: metric
  runLabel: run_id
  sampleSizeQuery: 1
```

### Pushing from CI

Eval jobs are batch jobs, so they push to a Prometheus
[Pushgateway](https://github.com/prometheus/pushgateway) scraped with `honor_labels: true`.
`dev/eval-push.sh` is a reference pusher in POSIX sh with curl, base64, sed and tr; it runs in
alpine, busybox, `curlimages/curl` and every common CI runner.

```bash
export PUSHGATEWAY_URL=https://pushgateway.example.com
dev/eval-push.sh push --model model-a --prompt-version v3 --run-id "$CI_RUN_ID" --cases 480 \
  faithfulness=0.84 answer_relevance=0.83 toxicity=0.018 latency_p95_seconds=1.10 \
  cost_per_case_usd=0.0039

dev/eval-push.sh forget --model model-a --prompt-version v3   # remove that group
```

| Variable          | Default                 | Meaning                                        |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `PUSHGATEWAY_URL` | `http://localhost:9091` | the Pushgateway                                |
| `EVAL_JOB`        | `llm_eval`              | `job` label of the pushed groups               |
| `CURL_OPTS`       | none                    | extra curl options, such as `--cacert` or `-u` |

The grouping key is `job`, `model` and `prompt_version`, base64url-encoded in the URL so a `/` in a
model name is safe. `run_id` is not in the key: a new run replaces the previous run of the same model
and prompt version in the gateway, which keeps the gateway small. Prometheus keeps the history, so a
range query returns each run as its own series and `baseline.mode: previousRun` compares the newest
run with the one before it. The panel's time range must cover at least two runs for that.

A GitHub Actions step, for example:

```yaml
- name: Push eval scores
  env:
    PUSHGATEWAY_URL: ${{ vars.PUSHGATEWAY_URL }}
  run: |
    ./eval-push.sh push --model "$MODEL" --prompt-version "$PROMPT_VERSION" \
      --run-id "$GITHUB_RUN_ID" --cases "$CASES" $(cat scores.txt)   # METRIC=VALUE per line
```

## Flow matrix (demo)

`dev/fake-flows.sh` pushes Hubble-style flow rates under job `hubble_flows`, one group per source
namespace:

| Metric      | Labels                                                                           | Value   |
| ----------- | -------------------------------------------------------------------------------- | ------- |
| `flow_rate` | `source_namespace`, `destination_namespace`, `source_group`, `verdict`, `window` | flows/s |

The panel uses `rowLabels: [source_namespace]`, `columnLabel: destination_namespace`,
`runLabel: window`, `rowTree: source_group` and `previousRun`, with every column `better: lower`
for dropped flows. With real Hubble metrics the run would be a time window rather than a label; the
`window` label stands in for that in the demo.

## Image checks (demo)

`dev/fake-checks.sh` pushes acceptance checks under job `image_checks`, one group per image:

| Metric              | Labels                                   | Value              |
| ------------------- | ---------------------------------------- | ------------------ |
| `image_check_value` | `image`, `base_image`, `check`, `run_id` | the check's result |

Checks are `startup_seconds`, `image_size_mb` and `cve_high` (lower is better) and
`smoke_pass_ratio` (higher is better). The panel uses `rowLabels: [image]`, `columnLabel: check`,
`rowTree: base_image` and `previousRun`, so each image sits under its base image and is compared
with its previous build.
