import { FormatOptions, formatValue } from "@perses-dev/components";
import { Delta } from "./delta";

/** Values without a column format: plain decimals, up to 3 significant places after the point. */
export const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

export function formatCellValue(value: number, format?: FormatOptions): string {
  if (!Number.isFinite(value)) return String(value);
  return formatValue(value, format ?? DEFAULT_FORMAT);
}

/** How many percentage points one unit of the format is, or undefined for a non-percent unit. */
function percentPointsPerUnit(format?: FormatOptions): number | undefined {
  switch (format?.unit) {
    case "percent-decimal":
      return 100;
    case "percent":
    case "%":
      return 1;
    default:
      return undefined;
  }
}

const sign = (n: number): string => (n > 0 ? "+" : n < 0 ? "−" : "±");

/**
 * value − baseline in the column's unit with a sign: "+0.05", "−120ms", and for percent units in
 * percentage points, "+2.6 pp".
 */
export function formatAbsoluteChange(
  absolute: number,
  format?: FormatOptions,
): string {
  if (!Number.isFinite(absolute)) return String(absolute);
  const pp = percentPointsPerUnit(format);
  if (pp !== undefined) {
    const points = Math.abs(absolute) * pp;
    const decimals =
      format && "decimalPlaces" in format && format.decimalPlaces !== undefined
        ? format.decimalPlaces
        : points < 10
          ? 1
          : 0;
    return `${sign(absolute)}${points.toFixed(decimals)} pp`;
  }
  return `${sign(absolute)}${formatValue(Math.abs(absolute), format ?? DEFAULT_FORMAT)}`;
}

/** The relative change as a signed percentage, "+217%", "−8.1%"; "n/a" against a zero baseline. */
export function formatRelativeChange(relative: number | undefined): string {
  if (relative === undefined || !Number.isFinite(relative)) return "n/a";
  const pct = Math.abs(relative) * 100;
  const decimals = pct < 10 ? 1 : 0;
  return `${sign(relative)}${pct.toFixed(decimals)}%`;
}

/** The word under a value: "better", "worse" or "same". */
export function deltaWord(delta: Delta): string {
  return delta.status;
}

/** The glyph before the word; ▲ and ▼ say better or worse, not up or down. */
export function deltaGlyph(delta: Delta): string {
  switch (delta.status) {
    case "better":
      return "▲";
    case "worse":
      return "▼";
    default:
      return "=";
  }
}

/** "worse (large regression)" and friends, for accessible names and the detail strip. */
export function deltaDescription(delta: Delta): string {
  if (delta.status === "worse") {
    return `worse (${delta.size === "large" ? "large" : "small"} regression)`;
  }
  return delta.status;
}
