# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-13

### Added

- `EvalMatrixChart` panel: rows and columns from labels, each cell a value with its change against
  a baseline, either a reference row or the row's previous run.
- Direction-aware deltas: every column is higher or lower is better; a change within the tolerance
  is same, otherwise better or worse, and a regression is small or large. Shown as glyph, word and
  colour, never colour alone.
- Relative or absolute tolerances per panel and per column, with separate `same` and `large`
  thresholds.
- A detail strip per cell with the baseline row and run, absolute and relative change, sample size
  against the baseline's, the run id and a link built from `cellLink`.
- An optional row tree (`rowTree`) with collapsible parents and groups, and sorting by any column
  with the baseline kept on top.
- Options `rowLabels`, `columnLabel`, `runLabel`, `baseline`, `columns`, `tolerance`, `rowTree`,
  `sampleSizeQuery`, `cellLink` and `cellLinkLabel`, each with a control in the panel editor, and
  their CUE schema with valid and invalid test cases.
- The LLM eval metric contract (`docs/metrics.md`) and a reference Pushgateway pusher
  (`dev/eval-push.sh`).
- A `dev/` stack (Perses, Prometheus, Pushgateway and three fake producers) with LLM eval, flow
  matrix and image check dashboards, and light and dark screenshots taken from it.
- Jest and React Testing Library tests, CI on pull requests, and a release workflow that publishes
  the archive and `ghcr.io/astrona-io/perses-plugin-evalmatrix` for linux/amd64 and linux/arm64.

[Unreleased]: https://github.com/astrona-io/perses-plugin-evalmatrix/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/astrona-io/perses-plugin-evalmatrix/releases/tag/v0.1.0
