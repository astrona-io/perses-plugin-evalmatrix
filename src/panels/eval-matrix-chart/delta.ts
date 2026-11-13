import {
  Better,
  DEFAULT_TOLERANCE,
  Tolerance,
} from "./eval-matrix-chart-types";

export type DeltaStatus = "better" | "same" | "worse";
export type RegressionSize = "small" | "large";

export interface Delta {
  status: DeltaStatus;
  /** How big a regression is; set only when `status` is "worse". */
  size?: RegressionSize;
  /** value − baseline, in the column's unit. */
  absolute: number;
  /** (value − baseline) / |baseline|; undefined when the baseline is 0 and the value is not. */
  relative?: number;
}

/** Float noise allowed when comparing a change with a tolerance bound. */
const EPSILON = 1e-9;

/** The column's tolerance over the panel's, over the defaults; `large` never below `same`. */
export function resolveTolerance(
  column?: Tolerance,
  panel?: Tolerance,
): Required<Tolerance> {
  const t = column ?? panel ?? DEFAULT_TOLERANCE;
  const mode = t.mode ?? DEFAULT_TOLERANCE.mode;
  const same = Number.isFinite(t.same) && t.same >= 0 ? t.same : 0;
  // Without `large`: 10 % for a relative tolerance, ten times `same` for an absolute one.
  const fallbackLarge =
    mode === "relative" ? Math.max(DEFAULT_TOLERANCE.large, same) : same * 10;
  const large =
    t.large !== undefined && Number.isFinite(t.large) && t.large >= 0
      ? t.large
      : fallbackLarge;
  return { mode, same, large: Math.max(large, same) };
}

/**
 * Compares a value with its baseline, direction-aware: for a `lower` column a drop is "better".
 * The size of the change is relative to the baseline or absolute, per `tolerance.mode`. A change up
 * to `tolerance.same` is "same"; a regression of at least `tolerance.large` is large. With a
 * relative tolerance and a zero baseline, any change is large. Returns undefined when either
 * number is not finite.
 */
export function compareToBaseline(
  value: number,
  baseline: number,
  better: Better,
  tolerance: Required<Tolerance>,
): Delta | undefined {
  if (!Number.isFinite(value) || !Number.isFinite(baseline)) return undefined;
  const absolute = value - baseline;
  let relative: number | undefined;
  if (baseline !== 0) relative = absolute / Math.abs(baseline);
  else if (absolute === 0) relative = 0;

  const size =
    tolerance.mode === "absolute"
      ? Math.abs(absolute)
      : relative === undefined
        ? Number.POSITIVE_INFINITY
        : Math.abs(relative);

  if (size <= tolerance.same + EPSILON) {
    return { status: "same", absolute, relative };
  }
  const improved = better === "lower" ? absolute < 0 : absolute > 0;
  if (improved) return { status: "better", absolute, relative };
  return {
    status: "worse",
    size: size + EPSILON >= tolerance.large ? "large" : "small",
    absolute,
    relative,
  };
}
