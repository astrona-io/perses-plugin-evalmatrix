import { FormatOptions } from "@perses-dev/components";
import { TimeSeries, TimeSeriesData } from "@perses-dev/spec";
import { compareToBaseline, Delta, resolveTolerance } from "./delta";
import {
  Better,
  DEFAULT_BETTER,
  DEFAULT_RUN_LABEL,
  EvalMatrixChartOptions,
  ROW_KEY_SEPARATOR,
  Tolerance,
} from "./eval-matrix-chart-types";

export interface Sample {
  value: number;
  /** Unix ms of the last non-null sample. */
  at: number;
  /** Unix ms of the first non-null sample. */
  firstAt: number;
}

export interface MatrixColumn {
  name: string;
  displayName: string;
  better: Better;
  format?: FormatOptions;
  tolerance: Required<Tolerance>;
}

export interface Cell {
  value: number;
  /** The value compared with, from the baseline row or the previous run. */
  baseline?: number;
  delta?: Delta;
}

export interface MatrixRow {
  /** The row key: the `rowLabels` values joined with " · ". Group rows have their own ids. */
  id: string;
  display: string;
  /** The `rowLabels` values. */
  labels: Record<string, string>;
  /** The run shown, when the data has a run label. */
  runId?: string;
  /** The run compared with: the baseline row's run, or this row's previous run. */
  baselineRunId?: string;
  sampleSize?: number;
  baselineSampleSize?: number;
  /** The `rowTree` label's value: the key of the parent row or the name of a group. */
  parentKey?: string;
  parentId?: string;
  childIds: string[];
  depth: number;
  /** A row made for a `rowTree` parent that has no data of its own. */
  isGroup: boolean;
  isBaseline: boolean;
  cells: Record<string, Cell>;
}

export type ModelStatus = "ok" | "no-data" | "no-match";

export interface MatrixModel {
  status: ModelStatus;
  columns: MatrixColumn[];
  rowsById: Map<string, MatrixRow>;
  /** Top-level rows except the baseline row, unsorted. */
  rootIds: string[];
  baselineRowId?: string;
  /** Problems worth showing above the grid, such as a baseline row that is not in the data. */
  notes: string[];
  /** Series without the column label or any row label. */
  ignoredSeries: number;
}

interface Run {
  runId: string;
  firstSeen: number;
  lastSeen: number;
  values: Map<string, Sample>;
  parentKey?: string;
}

interface RowData {
  key: string;
  labels: Record<string, string>;
  runs: Map<string, Run>;
}

export const collator = new Intl.Collator("en", { numeric: true });

/** The last non-null, finite sample of a series, or undefined when it has none. */
export function lastSample(series: TimeSeries): Sample | undefined {
  const values = series.values ?? [];
  let last: Sample | undefined;
  for (let i = values.length - 1; i >= 0; i--) {
    const tuple = values[i];
    if (!tuple) continue;
    const [at, v] = tuple;
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      last = { value: v, at, firstAt: at };
      break;
    }
  }
  if (!last) return undefined;
  for (const tuple of values) {
    if (tuple && tuple[1] !== null && Number.isFinite(tuple[1])) {
      last.firstAt = tuple[0];
      break;
    }
  }
  return last;
}

/** The row key of a series: its `rowLabels` values joined; undefined when it has none of them. */
export function rowKeyOf(
  labels: Record<string, string>,
  rowLabels: readonly string[],
): { key: string; values: Record<string, string> } | undefined {
  const values: Record<string, string> = {};
  let any = false;
  for (const name of rowLabels) {
    const v = labels[name] ?? "";
    if (v) any = true;
    values[name] = v;
  }
  if (!any) return undefined;
  return {
    key: rowLabels.map((n) => values[n] || "–").join(ROW_KEY_SEPARATOR),
    values,
  };
}

/** Oldest first: by first sample in the range, then last sample, then run id. */
function compareRuns(a: Run, b: Run): number {
  if (a.firstSeen !== b.firstSeen) return a.firstSeen - b.firstSeen;
  if (a.lastSeen !== b.lastSeen) return a.lastSeen - b.lastSeen;
  return collator.compare(a.runId, b.runId);
}

/** Listed columns in their order, then the other columns found, alphabetically. */
export function resolveColumns(
  found: Iterable<string>,
  options: Pick<EvalMatrixChartOptions, "columns" | "tolerance">,
): MatrixColumn[] {
  const listed = (options.columns ?? []).filter((c) => c.name);
  const seen = new Set<string>();
  const out: MatrixColumn[] = [];
  for (const c of listed) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    out.push({
      name: c.name,
      displayName: c.displayName || c.name,
      better: c.better ?? DEFAULT_BETTER,
      format: c.format,
      tolerance: resolveTolerance(c.tolerance, options.tolerance),
    });
  }
  const rest = [...new Set(found)]
    .filter((n) => !seen.has(n))
    .sort(collator.compare);
  for (const name of rest) {
    out.push({
      name,
      displayName: name,
      better: DEFAULT_BETTER,
      tolerance: resolveTolerance(undefined, options.tolerance),
    });
  }
  return out;
}

const sampleKey = (rowKey: string, runId: string): string =>
  `${rowKey}\u0000${runId}`;

export const GROUP_PREFIX = "\u0001group:";

/**
 * Turns the query results into a matrix: one row per `rowLabels` combination (its newest run), one
 * column per `columnLabel` value, each cell compared with the baseline. Pure; call it in a `useMemo`.
 */
export function buildModel(
  results: ReadonlyArray<{ data?: TimeSeriesData }>,
  options: EvalMatrixChartOptions,
): MatrixModel {
  const rowLabels = (options.rowLabels ?? []).filter(Boolean);
  const columnLabel = options.columnLabel;
  const runLabel = options.runLabel || DEFAULT_RUN_LABEL;
  const sampleSizeQuery = options.sampleSizeQuery;

  const rowData = new Map<string, RowData>();
  const sampleSizes = new Map<string, Sample>();
  const foundColumns = new Set<string>();
  let seriesCount = 0;
  let ignoredSeries = 0;

  results.forEach((result, queryIndex) => {
    const isSampleSize = queryIndex === sampleSizeQuery;
    for (const series of result.data?.series ?? []) {
      seriesCount++;
      const labels = series.labels ?? {};
      const row = rowKeyOf(labels, rowLabels);
      if (!row) {
        ignoredSeries++;
        continue;
      }
      const sample = lastSample(series);
      if (!sample) continue;
      const runId = labels[runLabel] ?? "";

      if (isSampleSize) {
        const key = sampleKey(row.key, runId);
        const prev = sampleSizes.get(key);
        if (!prev || prev.at <= sample.at) sampleSizes.set(key, sample);
        continue;
      }

      const column = columnLabel ? labels[columnLabel] : undefined;
      if (!column) {
        ignoredSeries++;
        continue;
      }
      foundColumns.add(column);
      let data = rowData.get(row.key);
      if (!data) {
        data = { key: row.key, labels: row.values, runs: new Map() };
        rowData.set(row.key, data);
      }
      let run = data.runs.get(runId);
      if (!run) {
        run = {
          runId,
          firstSeen: sample.firstAt,
          lastSeen: sample.at,
          values: new Map(),
        };
        data.runs.set(runId, run);
      } else {
        run.firstSeen = Math.min(run.firstSeen, sample.firstAt);
        run.lastSeen = Math.max(run.lastSeen, sample.at);
      }
      const prev = run.values.get(column);
      if (!prev || prev.at <= sample.at) run.values.set(column, sample);
      if (options.rowTree) {
        const parent = labels[options.rowTree];
        if (parent) run.parentKey = parent;
      }
    }
  });

  const columns = resolveColumns(foundColumns, options);
  const empty = (status: ModelStatus): MatrixModel => ({
    status,
    columns,
    rowsById: new Map(),
    rootIds: [],
    notes: [],
    ignoredSeries,
  });
  if (seriesCount === 0) return empty("no-data");
  if (rowData.size === 0) return empty("no-match");

  const sampleSizeOf = (rowKey: string, runId: string): number | undefined =>
    (
      sampleSizes.get(sampleKey(rowKey, runId)) ??
      sampleSizes.get(sampleKey(rowKey, ""))
    )?.value;

  // Rows: the newest run, and the run before it for a previous-run baseline.
  const rowsById = new Map<string, MatrixRow>();
  const previousRuns = new Map<string, Run>();
  for (const data of rowData.values()) {
    const runs = [...data.runs.values()].sort(compareRuns);
    const current = runs[runs.length - 1]!;
    const previous = runs.length > 1 ? runs[runs.length - 2] : undefined;
    if (previous) previousRuns.set(data.key, previous);
    const cells: Record<string, Cell> = {};
    for (const [column, sample] of current.values) {
      cells[column] = { value: sample.value };
    }
    rowsById.set(data.key, {
      id: data.key,
      display: data.key,
      labels: data.labels,
      runId: current.runId || undefined,
      sampleSize: sampleSizeOf(data.key, current.runId),
      parentKey: current.parentKey,
      childIds: [],
      depth: 0,
      isGroup: false,
      isBaseline: false,
      cells,
    });
  }

  // Baseline.
  const notes: string[] = [];
  let baselineRowId: string | undefined;
  const byColumn = new Map(columns.map((c) => [c.name, c]));
  const compareRow = (
    row: MatrixRow,
    baselineValues: (column: string) => number | undefined,
  ): void => {
    for (const [column, cell] of Object.entries(row.cells)) {
      const meta = byColumn.get(column);
      const base = baselineValues(column);
      if (!meta || base === undefined) continue;
      cell.baseline = base;
      cell.delta = compareToBaseline(
        cell.value,
        base,
        meta.better,
        meta.tolerance,
      );
    }
  };

  if (options.baseline?.mode === "row") {
    const wanted = options.baseline.row?.trim();
    const key =
      wanted || [...rowsById.keys()].sort(collator.compare)[0] || undefined;
    const baseline = key ? rowsById.get(key) : undefined;
    if (!baseline) {
      notes.push(`Baseline row "${wanted}" is not in the data`);
    } else {
      baseline.isBaseline = true;
      baselineRowId = baseline.id;
      for (const row of rowsById.values()) {
        if (row === baseline) continue;
        row.baselineRunId = baseline.runId;
        row.baselineSampleSize = baseline.sampleSize;
        compareRow(row, (c) => baseline.cells[c]?.value);
      }
    }
  } else if (options.baseline?.mode === "previousRun") {
    for (const row of rowsById.values()) {
      const previous = previousRuns.get(row.id);
      if (!previous) continue;
      row.baselineRunId = previous.runId || undefined;
      row.baselineSampleSize = sampleSizeOf(row.id, previous.runId);
      compareRow(row, (c) => previous.values.get(c)?.value);
    }
  }

  // Tree: parent is the row named by `rowTree`, or a group row for that name.
  if (options.rowTree) {
    for (const row of [...rowsById.values()]) {
      const parentKey = row.parentKey;
      if (!parentKey || parentKey === row.id || row.isBaseline) continue;
      const parent = rowsById.get(parentKey);
      if (parent) {
        if (!parent.isBaseline && !parent.isGroup) row.parentId = parent.id;
        continue;
      }
      const groupId = GROUP_PREFIX + parentKey;
      if (!rowsById.has(groupId)) {
        rowsById.set(groupId, {
          id: groupId,
          display: parentKey,
          labels: {},
          childIds: [],
          depth: 0,
          isGroup: true,
          isBaseline: false,
          cells: {},
        });
      }
      row.parentId = groupId;
    }

    // Break cycles: a row whose chain of parents leads back to itself becomes a root.
    for (const row of rowsById.values()) {
      const seen = new Set<string>([row.id]);
      let current = row.parentId ? rowsById.get(row.parentId) : undefined;
      while (current) {
        if (seen.has(current.id)) {
          row.parentId = undefined;
          break;
        }
        seen.add(current.id);
        current = current.parentId ? rowsById.get(current.parentId) : undefined;
      }
    }
  }

  const rootIds: string[] = [];
  for (const row of rowsById.values()) {
    const parent = row.parentId ? rowsById.get(row.parentId) : undefined;
    if (parent) parent.childIds.push(row.id);
    else if (!row.isBaseline) rootIds.push(row.id);
  }

  // Depth, without recursion so deep chains cannot overflow the stack.
  const stack = rootIds.map((id) => ({ id, depth: 0 }));
  while (stack.length) {
    const { id, depth } = stack.pop()!;
    const row = rowsById.get(id);
    if (!row) continue;
    row.depth = depth;
    for (const child of row.childIds)
      stack.push({ id: child, depth: depth + 1 });
  }

  return {
    status: "ok",
    columns,
    rowsById,
    rootIds,
    baselineRowId,
    notes,
    ignoredSeries,
  };
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  /** A column name; undefined sorts by row name. */
  column?: string;
  direction: SortDirection;
}

/** The direction a click on a column header starts with: best values first. */
export function defaultSortDirection(column?: MatrixColumn): SortDirection {
  if (!column) return "asc";
  return column.better === "lower" ? "asc" : "desc";
}

/**
 * The rows in drawing order: the baseline row first, then the tree depth-first, siblings sorted by
 * the chosen column (rows without a value last) and then by name.
 */
export function arrangeRows(model: MatrixModel, sort: SortState): MatrixRow[] {
  const { rowsById } = model;
  const factor = sort.direction === "desc" ? -1 : 1;
  const byName = (a: MatrixRow, b: MatrixRow): number =>
    collator.compare(a.display, b.display);
  const compare = (a: MatrixRow, b: MatrixRow): number => {
    if (sort.column) {
      const va = a.cells[sort.column]?.value;
      const vb = b.cells[sort.column]?.value;
      if (va !== undefined && vb !== undefined && va !== vb)
        return (va - vb) * factor;
      if (va !== undefined && vb === undefined) return -1;
      if (va === undefined && vb !== undefined) return 1;
      return byName(a, b);
    }
    return byName(a, b) * factor;
  };
  const sorted = (ids: readonly string[]): MatrixRow[] =>
    ids
      .map((id) => rowsById.get(id))
      .filter((r): r is MatrixRow => r !== undefined)
      .sort(compare);

  const out: MatrixRow[] = [];
  const baseline = model.baselineRowId
    ? rowsById.get(model.baselineRowId)
    : undefined;
  if (baseline) out.push(baseline);
  const stack = sorted(model.rootIds).reverse();
  while (stack.length) {
    const row = stack.pop()!;
    out.push(row);
    const children = sorted(row.childIds);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
  }
  return out;
}

/** The rows to draw: every row whose ancestors are all expanded. */
export function visibleRows(
  rows: readonly MatrixRow[],
  collapsed: ReadonlySet<string>,
): MatrixRow[] {
  if (collapsed.size === 0) return rows.slice();
  const out: MatrixRow[] = [];
  let hideBelow: number | undefined;
  for (const row of rows) {
    if (hideBelow !== undefined) {
      if (row.depth > hideBelow) continue;
      hideBelow = undefined;
    }
    out.push(row);
    if (collapsed.has(row.id) && row.childIds.length) hideBelow = row.depth;
  }
  return out;
}
