# Plan

Design for `EvalMatrixChart` 0.1.0, written before the code. `DECISIONS.md` records where the code
follows it and where it differs.

## Goal

One generic panel for a rows × columns matrix where every cell shows a value and how it moved
against a baseline, with the direction (higher or lower is better) known per column. Three uses
share it:

- **LLM evals**: rows are `model · prompt_version`, columns are eval metrics (faithfulness,
  toxicity, latency, cost), the baseline is a reference model or the previous run.
- **Flow matrices**: rows are source namespaces, columns destination namespaces, values are flow or
  drop rates, the baseline is the previous run (a window) or a reference row.
- **OAT-style checks**: rows are images (in a base → dependent tree), columns are checks.

It is the baseline/delta layer on top of a plain categorical matrix: the upstream proposal for a
generic `MatrixChart` ([perses/perses#4573](https://github.com/perses/perses/issues/4573)) colours
cells by value; this panel colours them by change against a baseline.

## Data model

Input: `TimeSeriesData` from any `TimeSeriesQuery` (datasource-agnostic). Each series is reduced to
its last non-null sample.

- `rowLabels` (one or more label names) give the row key; values are joined with `·`.
- `columnLabel` gives the column.
- `runLabel` (default `run_id`) tells runs apart. For each row the newest run is shown. Runs are
  ordered by their first sample in the range, then by run id (numeric-aware collation).
- `sampleSizeQuery` (optional, query index) names a query whose series give the sample size per row
  and run (for example `llm_eval_cases_total`); its series carry no column label.
- `rowTree` (optional label): a row's parent is the row whose key equals the label's value; when
  no such row exists, a group row with that name is created. This covers the OAT tree
  (`image` under `base_image`) and grouping (namespaces under a cluster).

Model (pure, memoised `buildModel`):

```
MatrixModel { status, columns: MatrixColumn[], rows: Map<id, MatrixRow>, baselineRowId?, notes }
MatrixColumn { name, displayName, better: higher|lower, format, tolerance }
MatrixRow { id, display, labels, runId, previousRunId, sampleSize, parentId, childIds,
            isGroup, isBaseline, cells: Record<column, Cell> }
Cell { value, baseline?, baselineRunId?, delta? }
Delta { status: better|same|worse, severity?: small|large, absolute, relative? }
```

`arrangeRows(model, sort)` turns that into the drawn order: baseline first, then the tree,
siblings sorted by the chosen column (or by name). `visibleRows` (from oat-results) drops rows under
collapsed parents.

## Deltas

`diff = value − baseline`, `relative = diff / |baseline|` (undefined when the baseline is 0).
The change size is `|relative|` or `|diff|` per `tolerance.mode`. At or below `tolerance.same` the
cell is **same**. Otherwise it is **better** when it moved in the column's good direction, else
**worse**: a small regression (amber) below `tolerance.large`, a large one (red) at or above it. A
zero baseline with a relative tolerance: equal values are same, anything else is a large change.

## Component tree

```
EvalMatrixChartComponent
├── summary line (rows, columns, baseline, sample size, legend)
├── scroll box
│   └── <table>
│       ├── header: row-name sort button, one sort button per column with ↑/↓
│       └── MatrixRow (memo) × n
│           ├── <th scope=row>: tree toggle, name, "baseline" / "vs run …" caption
│           └── MatrixCell button × columns: value, ▲ better / ▼ worse / = same
└── DetailStrip: value vs baseline, absolute and relative change, sample size, run, cellLink
```

Copied from oat-results and refactored: the table and sticky header/first column styling, the row
tree (parenting, cycle breaking, depth-first order, `visibleRows`), memoised rows, the detail strip
and the link interpolation with its scheme check.

## Schema

```cue
kind: "EvalMatrixChart"
spec: close({
  rowLabels:   [#labelName, ...#labelName]
  columnLabel: #labelName
  runLabel?:   #labelName
  baseline?:   close({ mode: "row" | "previousRun", row?: string })
  columns?:    [...close({ name, displayName?, format?: common.#format, better?: "higher" | "lower",
                           tolerance?: #tolerance })]
  tolerance?:  #tolerance   // close({ mode: "relative" | "absolute", same: number >= 0, large?: number >= 0 })
  rowTree?:    #labelName
  sampleSizeQuery?: int >= 0
  cellLink?:      string
  cellLinkLabel?: string
})
```

## Dev stack

Perses v0.55.1, Prometheus, a Pushgateway and three fake producers:

- `dev/eval-push.sh`, the reference pusher: one eval run's scores and case count, as a POSIX sh
  script with curl, usable from CI.
- `dev/fake-evals.sh` calls it for four models over a few runs.
- `dev/fake-flows.sh`: Hubble-style `flow_rate` per source and destination namespace.
- `dev/fake-checks.sh`: OAT-style check results per image with a base image.

Three dashboards in `dev/dashboards/`.

## Tests

- Delta classification for higher- and lower-is-better columns, both tolerance modes, zero baseline.
- `buildModel`: rows and columns, newest run, previous-run baseline, missing baseline row, sample
  size, tree and group rows, malformed series.
- Sorting and arrangement with the baseline pinned.
- Rendering: empty, no matching series, arrows and words, detail strip, links, keyboard, sorting,
  200 rows × 12 columns.
- Settings editor: each control writes its option.

## Open questions

- MLflow or Langfuse as datasources: out of scope; the panel only needs time series with labels.
- Sharing the grid with oat-results as a package: later (see `DECISIONS.md`).
