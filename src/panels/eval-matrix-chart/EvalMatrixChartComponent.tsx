import { ReactElement, useCallback, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  arrangeRows,
  buildModel,
  defaultSortDirection,
  MatrixColumn,
  SortState,
  visibleRows,
} from "./data";
import { DetailStrip } from "./DetailStrip";
import { MatrixRowView } from "./MatrixRowView";
import { EvalMatrixChartProps } from "./eval-matrix-chart-types";
import { resolveColours, Tone } from "./colours";

interface Selection {
  rowId: string;
  column: string;
}

const LEGEND: Array<{ tone: Tone; glyph: string; label: string }> = [
  { tone: "better", glyph: "▲", label: "better" },
  { tone: "same", glyph: "=", label: "same" },
  { tone: "worseSmall", glyph: "▼", label: "worse (small)" },
  { tone: "worseLarge", glyph: "▼", label: "worse (large)" },
];

const directionArrow = (column: MatrixColumn): string =>
  column.better === "lower" ? "↓" : "↑";

export function EvalMatrixChartComponent(
  props: EvalMatrixChartProps,
): ReactElement {
  const { queryResults, spec, contentDimensions } = props;
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [selection, setSelection] = useState<Selection | undefined>();
  const [sort, setSort] = useState<SortState>({ direction: "asc" });

  const model = useMemo(
    () => buildModel(queryResults, spec),
    [queryResults, spec],
  );
  const arranged = useMemo(() => arrangeRows(model, sort), [model, sort]);
  const rows = useMemo(
    () => visibleRows(arranged, collapsed),
    [arranged, collapsed],
  );
  const colours = useMemo(() => resolveColours(theme), [theme]);

  const onToggle = useCallback((rowId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);
  const onSelect = useCallback((rowId: string, column: string) => {
    setSelection((prev) =>
      prev && prev.rowId === rowId && prev.column === column
        ? undefined
        : { rowId, column },
    );
  }, []);
  const onClose = useCallback(() => setSelection(undefined), []);
  const onSort = useCallback((column?: MatrixColumn) => {
    setSort((prev) =>
      prev.column === column?.name
        ? { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column: column?.name, direction: defaultSortDirection(column) },
    );
  }, []);

  const height = contentDimensions?.height;
  const width = contentDimensions?.width;

  if (model.status !== "ok") {
    return (
      <Box
        sx={{
          height,
          width,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          p: 2,
          gap: 0.5,
        }}
      >
        <Typography variant="body2">
          {model.status === "no-data" ? "No data" : "No matching series"}
        </Typography>
        {model.status === "no-match" && (
          <Typography variant="caption" color="text.secondary">
            Expected series with the row label
            {spec.rowLabels.length === 1 ? "" : "s"}{" "}
            <code>{spec.rowLabels.join(", ") || "(none set)"}</code> and the
            column label <code>{spec.columnLabel || "(none set)"}</code>.
          </Typography>
        )}
      </Box>
    );
  }

  const selectedRow = selection
    ? model.rowsById.get(selection.rowId)
    : undefined;
  const selectedColumn = selection
    ? model.columns.find((c) => c.name === selection.column)
    : undefined;
  const baselineRow = model.baselineRowId
    ? model.rowsById.get(model.baselineRowId)
    : undefined;
  const dataRows = [...model.rowsById.values()].filter(
    (r) => !r.isGroup,
  ).length;
  const baselineText = baselineRow
    ? `baseline ${baselineRow.display}`
    : spec.baseline?.mode === "previousRun"
      ? "baseline: previous run"
      : spec.baseline
        ? undefined
        : "no baseline";

  const sortAria = (name?: string): "ascending" | "descending" | undefined =>
    sort.column === name
      ? sort.direction === "asc"
        ? "ascending"
        : "descending"
      : undefined;

  return (
    <Box
      sx={{
        height,
        width,
        display: "flex",
        flexDirection: "column",
        fontSize: "0.8125rem",
        color: "text.primary",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 1.5,
          rowGap: 0.25,
          px: 0.5,
          pb: 0.5,
          color: "text.secondary",
          fontSize: "0.75rem",
        }}
      >
        <span>
          {dataRows} row{dataRows === 1 ? "" : "s"} · {model.columns.length}{" "}
          column{model.columns.length === 1 ? "" : "s"}
          {baselineText ? ` · ${baselineText}` : ""}
        </span>
        {model.notes.map((note) => (
          <Box component="span" key={note} sx={{ color: "warning.main" }}>
            {note}
          </Box>
        ))}
        <Box
          component="ul"
          aria-label="Legend"
          sx={{
            display: "flex",
            gap: 1.25,
            m: 0,
            p: 0,
            listStyle: "none",
            ml: "auto",
          }}
        >
          {LEGEND.map(({ tone, glyph, label }) => (
            <Box
              component="li"
              key={tone}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
            >
              <span style={{ color: colours[tone].fg }} aria-hidden="true">
                {glyph}
              </span>
              {label}
            </Box>
          ))}
        </Box>
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          "& table": {
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
          },
          "& th, & td": {
            borderBottom: 1,
            borderColor: "divider",
            px: 0.25,
            py: 0.25,
            whiteSpace: "nowrap",
            textAlign: "center",
            fontWeight: "normal",
          },
          "& thead th": {
            position: "sticky",
            top: 0,
            zIndex: 2,
            backgroundColor: "background.paper",
            color: "text.secondary",
            fontWeight: 600,
            fontSize: "0.75rem",
          },
          "& thead th:first-of-type": { left: 0, zIndex: 3, textAlign: "left" },
          "& .em-sort": {
            background: "none",
            border: 0,
            p: 0.25,
            font: "inherit",
            color: "inherit",
            cursor: "pointer",
            borderRadius: 1,
          },
          "& .em-sort:hover": { color: "text.primary" },
          "& .em-name": {
            position: "sticky",
            left: 0,
            zIndex: 1,
            backgroundColor: "background.paper",
            textAlign: "left",
            pr: 1,
          },
          "& .em-name-line": { display: "flex", alignItems: "center" },
          "& .em-parent": { fontWeight: 700 },
          "& .em-caption": {
            fontSize: "0.7rem",
            color: "text.secondary",
            pl: "1.6rem",
          },
          "& .em-baseline-row .em-name, & .em-baseline-row td": {
            borderBottom: 2,
            borderBottomColor: "divider",
          },
          "& .em-muted": { color: "text.secondary" },
          "& .em-toggle": {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: 0,
            borderRadius: 1,
            p: 0.25,
            cursor: "pointer",
            color: "inherit",
            fontSize: "1.1rem",
          },
          "& .em-toggle-spacer": {
            display: "inline-flex",
            width: "1.6rem",
            justifyContent: "center",
            color: "text.disabled",
          },
          "& .em-cell": {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            minWidth: 72,
            border: 0,
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            font: "inherit",
            color: "text.primary",
            cursor: "pointer",
            lineHeight: 1.3,
          },
          "& .em-value": {
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          },
          "& .em-delta": { fontSize: "0.7rem" },
          "& .em-cell:hover": { filter: "brightness(0.95)" },
          "& .em-toggle:focus-visible, & .em-cell:focus-visible, & .em-sort:focus-visible":
            {
              outline: 2,
              outlineColor: "primary.main",
              outlineStyle: "solid",
            },
          "& .em-selected": {
            boxShadow: `inset 0 0 0 2px ${colours.selected}`,
          },
          "& .em-none": { color: "text.disabled" },
        }}
      >
        <table aria-label="Eval matrix">
          <thead>
            <tr>
              <th scope="col" aria-sort={sortAria(undefined) ?? "none"}>
                <button
                  type="button"
                  className="em-sort"
                  onClick={() => onSort(undefined)}
                >
                  {spec.rowLabels.join(" · ") || "Row"}
                  {sort.column === undefined
                    ? sort.direction === "asc"
                      ? " ▴"
                      : " ▾"
                    : ""}
                </button>
              </th>
              {model.columns.map((column) => (
                <th
                  scope="col"
                  key={column.name}
                  title={`${column.name}: ${column.better} is better`}
                  aria-sort={sortAria(column.name) ?? "none"}
                >
                  <button
                    type="button"
                    className="em-sort"
                    onClick={() => onSort(column)}
                  >
                    {column.displayName}{" "}
                    <span aria-label={`${column.better} is better`}>
                      {directionArrow(column)}
                    </span>
                    {sort.column === column.name
                      ? sort.direction === "asc"
                        ? " ▴"
                        : " ▾"
                      : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MatrixRowView
                key={row.id}
                row={row}
                columns={model.columns}
                colours={colours}
                selectedColumn={
                  selection?.rowId === row.id ? selection.column : undefined
                }
                collapsed={collapsed.has(row.id)}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </Box>
      {selectedRow && selectedColumn && (
        <DetailStrip
          row={selectedRow}
          column={selectedColumn}
          baselineRow={baselineRow}
          cellLink={spec.cellLink}
          cellLinkLabel={spec.cellLinkLabel}
          colours={colours}
          onClose={onClose}
        />
      )}
    </Box>
  );
}
