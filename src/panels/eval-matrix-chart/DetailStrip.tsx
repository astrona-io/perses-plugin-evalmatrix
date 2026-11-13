import { ReactElement, useMemo } from "react";
import { Box, IconButton, Link, Typography } from "@mui/material";
import {
  replaceVariablesInString,
  useAllVariableValues,
} from "@perses-dev/plugin-system";
import Close from "mdi-material-ui/Close";
import OpenInNew from "mdi-material-ui/OpenInNew";
import { MatrixColumn, MatrixRow } from "./data";
import { Colours, toneOf } from "./colours";
import {
  deltaDescription,
  deltaGlyph,
  formatAbsoluteChange,
  formatCellValue,
  formatRelativeChange,
} from "./format";
import { resolveCellLink } from "./links";
import { DEFAULT_CELL_LINK_LABEL } from "./eval-matrix-chart-types";

export interface DetailStripProps {
  row: MatrixRow;
  column: MatrixColumn;
  /** The baseline row, when the baseline is a row. */
  baselineRow?: MatrixRow;
  cellLink?: string;
  cellLinkLabel?: string;
  colours: Colours;
  onClose: () => void;
}

/** What one cell stands for: value vs baseline, change, sample size, run and the cell link. */
export function DetailStrip(props: DetailStripProps): ReactElement {
  const {
    row,
    column,
    baselineRow,
    cellLink,
    cellLinkLabel,
    colours,
    onClose,
  } = props;
  const variables = useAllVariableValues();
  const cell = row.cells[column.name];
  const delta = row.isBaseline ? undefined : cell?.delta;

  const href = useMemo(
    () =>
      resolveCellLink(
        cellLink,
        {
          row: row.display,
          column: column.name,
          run_id: row.runId,
          baseline_row: baselineRow?.display,
          baseline_run_id: row.baselineRunId,
        },
        (s) => replaceVariablesInString(s, variables),
      ),
    [cellLink, row, column.name, baselineRow, variables],
  );

  const baselineSource = baselineRow
    ? `${baselineRow.display}${row.baselineRunId ? `, run ${row.baselineRunId}` : ""}`
    : row.baselineRunId
      ? `previous run ${row.baselineRunId}`
      : undefined;
  const sampleSize =
    row.sampleSize !== undefined
      ? `${row.sampleSize}${row.baselineSampleSize !== undefined ? ` (baseline ${row.baselineSampleSize})` : ""}`
      : undefined;
  const tone = colours[toneOf(row.isBaseline, delta)];

  const fields: Array<[string, string | ReactElement | undefined]> = [
    ["Value", cell ? formatCellValue(cell.value, column.format) : "No value"],
    [
      "Baseline",
      row.isBaseline
        ? "This row is the baseline"
        : cell?.baseline !== undefined
          ? `${formatCellValue(cell.baseline, column.format)}${baselineSource ? ` (${baselineSource})` : ""}`
          : undefined,
    ],
    [
      "Change",
      delta ? formatAbsoluteChange(delta.absolute, column.format) : undefined,
    ],
    [
      "Relative change",
      delta ? formatRelativeChange(delta.relative) : undefined,
    ],
    [
      "Status",
      delta ? (
        <span style={{ color: tone.fg }}>
          {deltaGlyph(delta)} {deltaDescription(delta)} · {column.better} is
          better
        </span>
      ) : undefined,
    ],
    ["Sample size", sampleSize],
    ["Run", row.runId],
  ];

  return (
    <Box
      component="section"
      aria-label={`Details: ${row.display} ${column.displayName}`}
      sx={{
        borderTop: 1,
        borderColor: "divider",
        px: 1,
        py: 0.75,
        flexShrink: 0,
        maxHeight: "45%",
        overflow: "auto",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography
          variant="subtitle2"
          component="h3"
          sx={{ flexGrow: 1, textTransform: "none" }}
        >
          {row.display} · {column.displayName}
        </Typography>
        <IconButton size="small" aria-label="Close details" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
      <Box
        component="dl"
        sx={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 2,
          rowGap: 0.25,
          m: 0,
          fontSize: "0.8125rem",
          "& dt": { color: "text.secondary" },
          "& dd": { m: 0, wordBreak: "break-word" },
        }}
      >
        {fields
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([label, value]) => (
            <Box key={label} sx={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Box>
          ))}
      </Box>
      {href && (
        <Box sx={{ mt: 0.5 }}>
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            {cellLinkLabel || DEFAULT_CELL_LINK_LABEL}
            <OpenInNew fontSize="inherit" aria-hidden="true" />
          </Link>
        </Box>
      )}
    </Box>
  );
}
