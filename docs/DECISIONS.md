# Decisions

Choices made for `EvalMatrixChart` 0.1.0 and the reasons behind them. `PLAN.md` is the design as
written before the code; this file records where the code follows it and where it differs.

## A baseline/delta layer, not another matrix panel

[perses/perses#4573](https://github.com/perses/perses/issues/4573) proposes a generic `MatrixChart`
(a categorical 2D matrix, cells coloured by value). This plugin overlaps with it on the grid: rows
and columns from labels, a cell per pair. What it adds is the comparison: a baseline per cell (a
reference row or the previous run), a direction per column (higher or lower is better), tolerances,
and a status (better, same, small or large regression) shown as glyph, word and colour.

It is kept as its own plugin because the eval use case needs it now and the upstream panel's shape
is still open. The delta logic is deliberately separate from the drawing (`delta.ts`, `data.ts` are
pure and fully unit-tested), so once a `MatrixChart` lands upstream, baseline/delta could be
contributed to it as an option set (`baseline`, `better`, `tolerance`) instead of living here. That
contribution is not started; it would be proposed on #4573 first.

## Grid copied from oat-results, not shared yet

The table with its sticky header and first column, the row tree (parenting, cycle breaking,
depth-first order, collapsing), the memoised rows, the detail strip and the link interpolation with
its scheme check were copied from
[perses-plugin-oat-results](https://github.com/astrona-io/perses-plugin-oat-results) and refactored
for generic rows and columns. oat-results was not changed.

A shared package (for example `@astrona-io/perses-matrix-grid`) would remove the duplication, but
with two users, one of them brand new, the right seams are not known yet, and a package adds
a publish step and version skew between two plugins loaded into the same Perses. oat-results could
later depend on a shared package once the grid has settled here; until then a fix in one place has to
be ported to the other by hand.

## Perses 0.55.1

Pinned to `@perses-dev/*` 0.55.1, `@perses-dev/spec` 0.3.0, `percli` v0.55.1 and the shared CUE
module `github.com/perses/shared/cue` v0.55.1, the same as the other plugins in this family, so they
load into one Perses. Built with rsbuild and module federation as the percli scaffold sets up; Jest
with `@swc/jest`, ESLint 8 and Prettier as in oat-results.

## No Grafana migration

The plugin ships no `migrate/` CUE. The closest Grafana panel is the ESnet Matrix Panel
(`esnet-matrix-panel`), a source × destination heatmap coloured by value with no baseline, no
direction per column and no delta, so there is nothing in its options that maps onto a baseline
comparison. A migration would at best produce a matrix without the comparison, which is what #4573
covers; it is left to that panel.

## Deviations from the plan

- **`large` tolerance.** The plan had one threshold (`same`). Telling a small regression (amber)
  from a large one (red) needs a second one, so `tolerance` has `large`, defaulting to 10 % for a
  relative tolerance and ten times `same` for an absolute one, and never below `same`.
- **Delta field names.** `Delta.severity` in the plan is `Delta.size` in the code, to keep
  "severity" free for CVE-style data.
- **`runLabel`.** Added so data without a `run_id` label works: the flow demo uses `window`.
- **Sample size as its own query.** `sampleSizeQuery` names a query index rather than a label on the
  score series, because the case count is per run, not per metric, and pushing it once per run keeps
  the contract simple.
- **Zero baseline.** With a relative tolerance, equal values are same and any other change is large,
  rather than dividing by zero.
- **Run order.** Runs are ordered by their first sample in the time range, then by run id with a
  numeric-aware collation (`run-10` after `run-9`), so runs pushed in the same scrape still order.

## Pushgateway grouping without `run_id`

`dev/eval-push.sh` groups by `job`, `model` and `prompt_version`, not by `run_id`. Each push replaces
the previous run of that model and prompt version in the gateway, so the gateway does not grow
without bound; Prometheus keeps the history, so a range query still returns each run as its own
series and `previousRun` works. Grouping by `run_id` would keep every run in the gateway forever
unless something deleted them.

## Colour and accessibility

Cells are never coloured without a glyph and a word (▲ better, = same, ▼ worse), every cell is a
button with an accessible name that includes the status, and the column header carries ↑ or ↓ with
an `aria-label`. Colours come from the Perses theme's palette (success, warning, error), so light and
dark follow Perses.

## Out of scope

- MLflow, Langfuse or other eval stores as datasources: the panel only needs time series with labels;
  a datasource plugin could feed it later.
- Statistical significance of a change: the sample size is shown next to the delta so a reader can
  judge it, but no test is run.
