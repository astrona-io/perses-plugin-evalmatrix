import { FormatOptions } from "@perses-dev/components";
import { OptionsEditorProps, PanelProps } from "@perses-dev/plugin-system";
import { TimeSeriesData } from "@perses-dev/spec";

export type QueryData = TimeSeriesData;

export type EvalMatrixChartProps = PanelProps<
  EvalMatrixChartOptions,
  QueryData
>;
export type EvalMatrixChartEditorProps =
  OptionsEditorProps<EvalMatrixChartOptions>;

/** Which way a column improves. */
export type Better = "higher" | "lower";

export type BaselineMode = "row" | "previousRun";

/**
 * What the cells are compared with. `row`: one row (the baseline row, drawn on top); `previousRun`:
 * each row's own previous run.
 */
export interface BaselineOptions {
  mode: BaselineMode;
  /** The baseline row's key: its `rowLabels` values joined with " · ". The first row when unset. */
  row?: string;
}

export type ToleranceMode = "relative" | "absolute";

/**
 * How big a change has to be to count. With `relative`, 0.02 means 2 % of the baseline; with
 * `absolute`, it is in the column's unit.
 */
export interface Tolerance {
  mode: ToleranceMode;
  /** A change up to this size is "same". */
  same: number;
  /** A regression of at least this size is large (red); smaller ones are small (amber). */
  large?: number;
}

export interface ColumnOptions {
  /** The value of `columnLabel` this entry is for. */
  name: string;
  /** Header text. The name when unset. */
  displayName?: string;
  /** How values (and absolute changes) are shown. */
  format?: FormatOptions;
  /** Default higher. */
  better?: Better;
  /** Overrides the panel's tolerance for this column. */
  tolerance?: Tolerance;
}

export interface EvalMatrixChartOptions {
  /** Label names that define a row; their values are joined for display. */
  rowLabels: string[];
  /** Label name that defines the columns. */
  columnLabel: string;
  /** Label that tells runs apart. Default `run_id`. */
  runLabel?: string;
  /** No baseline when unset: cells show values only. */
  baseline?: BaselineOptions;
  /** Settings per column, in display order. Columns found in the data but not listed follow, with defaults. */
  columns?: ColumnOptions[];
  /** Default relative, same 0.01 (1 %), large 0.1 (10 %). */
  tolerance?: Tolerance;
  /** Label whose value names a row's parent: rows are nested under the row with that key, or under a group. */
  rowTree?: string;
  /** Index of the query that returns sample sizes per row and run (series without the column label). */
  sampleSizeQuery?: number;
  /** Link for the detail strip. Variables: ${row} ${column} ${run_id} ${baseline_row} ${baseline_run_id}, plus dashboard variables. */
  cellLink?: string;
  /** Text of the link. Default "Open failing cases". */
  cellLinkLabel?: string;
}

export const DEFAULT_RUN_LABEL = "run_id";
export const DEFAULT_TOLERANCE: Required<Tolerance> = {
  mode: "relative",
  same: 0.01,
  large: 0.1,
};
export const DEFAULT_BETTER: Better = "higher";
export const DEFAULT_CELL_LINK_LABEL = "Open failing cases";
export const ROW_KEY_SEPARATOR = " · ";

export function createInitialEvalMatrixChartOptions(): EvalMatrixChartOptions {
  return {
    rowLabels: ["model", "prompt_version"],
    columnLabel: "metric",
    baseline: { mode: "row" },
    tolerance: { ...DEFAULT_TOLERANCE },
  };
}
