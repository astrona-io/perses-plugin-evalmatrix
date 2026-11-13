You are a senior TypeScript/React (and, where needed, Go/CUE) engineer and Perses contributor. Build the Perses plugin described below in this repository (`perses-plugin-matrix`). Work autonomously: plan, build, test, document. Open a PR when it's done.

---

# Part 1: What to build. Eval matrix (generic rows × columns with baseline)

**Repo:** `astrona-io/perses-plugin-matrix`
**Plugin kind(s):** Panel: `MatrixChart`
**Focus area:** AI (also reused for OAT checks and flow matrices)
**Concept page:** https://claude.ai/artifact/KcToRbDWESkuMgDtPBrBvE#matrix (a private page; the owner can share it with you. Everything you need from it is in this prompt and in `docs/mockup.png`.)

## What it should look like
See `docs/mockup.png` in the repo. If it isn't there, ask for it. It's a concept sketch: match the idea and information density, not the exact pixels.

## Why
`perses-plugin-oat-results` already draws a rows × checks grid with a detail strip and a row tree. Pull that grid out into a generic panel so three use cases share one plugin: **LLM evals**, **network flow matrices**, and **OAT-style checks**. Every cell shows its value and whether it got better or worse than a baseline.

## Start by reading oat-results
Clone `astrona-io/perses-plugin-oat-results` and identify the grid, cell rendering, detail strip and row-tree code. Then decide (and write in `docs/DECISIONS.md`):
1. Copy the code into this repo now and refactor oat-results later, **or**
2. Extract a small shared package used by both.
Either way, oat-results must keep working. Don't change its public spec without a migration note.

## Data it reads
- Any query where one or two labels define rows and one label defines columns. Example eval metric contract (document it in `docs/metrics.md`):
  - `llm_eval_score{model, prompt_version, metric, run_id}`: value per metric
  - `llm_eval_cases_total{model, prompt_version, run_id}`: sample size
- An eval job pushes these via Pushgateway or remote-write. Ship a tiny reference pusher in `dev/`.
- Later: MLflow or Langfuse datasources. Keep the panel datasource-agnostic.

## Spec (options → CUE schema)
- `rowLabels`: one or more label names (joined for display, e.g. "model · prompt_version")
- `columnLabel`: label name for columns
- `baseline`: `{mode: row | previousRun, row: "<row key>"}`
- `columns`: list of `{name, displayName, format, better: higher | lower}`. Unlisted columns get defaults.
- `tolerance`: relative or absolute change that counts as "same"
- `rowTree`: optional parent label (reuse oat-results' tree)
- `cellLink`: link template with `${row}`, `${column}`, `${run_id}`

## Behaviour
- Baseline row on top in a neutral style. Other cells show the value plus "▲ better / ▼ worse / = same" (arrow + text, not colour alone), coloured green / amber (small regression) / red (large regression).
- Column headers show the direction (↑ or ↓ is better).
- Click a cell for the detail strip below the grid: value vs baseline, absolute and relative change, sample size, run, and `cellLink` ("Open failing cases").
- Sort rows by any column.

## Acceptance criteria
- Three demo dashboards in `dev/`: LLM evals (with the reference pusher), a namespace × namespace flow matrix (Hubble-style fake data), and OAT-style checks.
- 200 rows × 12 columns stay responsive.
- Direction-aware deltas are unit-tested (lower-is-better columns especially).
- oat-results still builds and its tests pass after any extraction.

## The plugin family this belongs to
This repo is part of the `astrona-io` Perses plugin set. Already built (read them before you start, and match their structure, tooling, CI and README style):
`perses-plugin-oat-results`, `perses-plugin-sankey`, `perses-plugin-statetimeline`, `perses-plugin-honeycomb`, `perses-plugin-geomap`, `perses-plugin-servicegraph`, all under https://github.com/astrona-io.
Use the same Perses version pin as those repos unless there's a newer stable release, then note it in `docs/DECISIONS.md`.

---

# Part 2: How to build it (Perses plugin guide)

You are building a **Perses plugin** in this repository. Perses is the CNCF
dashboard project (https://github.com/perses/perses). Its core plugins live in
https://github.com/perses/plugins.


## Ground rules

1. **Copy upstream conventions; don't invent your own.** Before writing code, clone
   `perses/plugins` next to this repo and read 2–3 plugins close to this one.
   Panels: `timeserieschart`, `statushistorychart`, `heatmapchart`, `table`.
   Datasources: `prometheus`, `tempo`, `victorialogs`.
   Match their folder layout, `package.json` (including the `perses` section),
   the CUE schema layout, and the rsbuild / module-federation config.
2. **Scaffold with percli. Never hand-build the directory structure.** Install
   `percli` from the Perses GitHub releases (or `brew install perses/tap/percli`).
   Then check the real flags with `percli plugin --help` and
   `percli plugin generate --help`. Flags change between releases, so don't
   trust memory or this file over `--help`.
   - `percli plugin generate …` scaffolds the module or plugin
   - `percli plugin start` runs it against a local Perses dev server
   - `percli plugin test-schemas` validates the CUE schemas and JSON examples
   - `percli plugin build` produces the distributable archive
3. **Use the latest stable Perses release.** Pin `@perses-dev/*` package versions
   to the release you develop against. Write that release in the README.
4. **Use the shared building blocks:**
   - `@perses-dev/plugin-system` for plugin types and hooks (`useDataQueries`,
     time range, variables)
   - `@perses-dev/components` for UI pieces, legends, tooltips and the ECharts wrapper
   - `@perses-dev/core` for value formatting, units and thresholds
   - Reuse the shared CUE types (`common.#format`, `common.#thresholds`, …) in schemas
5. **Theme-aware only.** No hard-coded colours. Use the MUI theme and the Perses
   chart theme so light and dark mode both work.
6. **Accessibility.** Status must never be shown by colour alone. Use icon,
   label or pattern too. Everything clickable must be reachable by keyboard.
7. **Performance.** Stay smooth at the "large" size named in Part 1.
   Memoise transforms. Don't re-render on hover.
8. **Licence.** Apache-2.0, same as Perses. Only add dependencies with
   compatible licences. Prefer libraries already used upstream (ECharts, MUI).
9. **Stay upstreamable.** Write it so it could be offered to `perses/plugins`
   later: same code style, lint config, tests and docs format. Before you start,
   search `perses/plugins` issues and PRs for this plugin. If someone is already
   building it, stop and report that.

## Local dev environment

Add a `dev/` folder with a `docker-compose.yaml` that starts:
- Perses (official image)
- the data backend this plugin needs (usually Prometheus)
- a **fake-data generator** that emits the metrics, logs or API responses in
  Part 1, with realistic labels and some failure cases

Also provision a demo dashboard that uses the plugin (`dev/dashboards/*.json`),
so `docker compose up` followed by `percli plugin start` shows it working.

## Definition of done

- [ ] Scaffolded with `percli`. Layout matches upstream plugins.
- [ ] CUE schema plus at least one JSON example. `percli plugin test-schemas` passes.
- [ ] Grafana migration (`migrate/` CUE) if Part 1 names a Grafana equivalent.
- [ ] Panel options editor for every option in the spec, with sensible defaults.
- [ ] Unit tests (Jest + React Testing Library) for data transforms and rendering.
      Cover the empty state, error state and large-data cases.
- [ ] Works in light and dark theme. Includes screenshots of both in `docs/`.
- [ ] `percli plugin build` produces an archive. CI builds it on every PR.
- [ ] A GitHub Actions release workflow attaches the archive to a GitHub release on `v*` tags.
- [ ] README covers what it does, install, the data it expects, the options, a screenshot,
      and the Perses version it was tested with.
- [ ] Every acceptance criterion in Part 1 is checked off in the PR description.

## Working style

- Plan first. Write `docs/PLAN.md` covering the data model, component tree,
  schema and open questions before writing code.
- Use small commits with conventional messages (`feat:`, `fix:`, `docs:`, `test:`).
- If something in Part 1 is unclear or seems wrong, record your decision in
  `docs/DECISIONS.md` and keep going. Don't stop for the sake of it.
