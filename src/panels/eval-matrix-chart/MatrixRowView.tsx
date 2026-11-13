import { memo, ReactElement } from "react";
import ChevronDown from "mdi-material-ui/ChevronDown";
import ChevronRight from "mdi-material-ui/ChevronRight";
import SubdirectoryArrowRight from "mdi-material-ui/SubdirectoryArrowRight";
import { MatrixColumn, MatrixRow } from "./data";
import { Colours, toneOf } from "./colours";
import {
  deltaDescription,
  deltaGlyph,
  deltaWord,
  formatCellValue,
} from "./format";

export interface MatrixRowViewProps {
  row: MatrixRow;
  columns: MatrixColumn[];
  colours: Colours;
  /** The selected column of this row, if the selection is in this row. */
  selectedColumn?: string;
  collapsed: boolean;
  onToggle: (rowId: string) => void;
  onSelect: (rowId: string, column: string) => void;
}

const INDENT_PX = 18;

/** One row. Memoised: it re-renders only when its own data, collapse or selection changes. */
export const MatrixRowView = memo(function MatrixRowView(
  props: MatrixRowViewProps,
): ReactElement {
  const {
    row,
    columns,
    colours,
    selectedColumn,
    collapsed,
    onToggle,
    onSelect,
  } = props;
  const isParent = row.childIds.length > 0;
  const caption = row.isBaseline
    ? "baseline"
    : row.baselineRunId
      ? `vs run ${row.baselineRunId}`
      : undefined;

  return (
    <tr
      data-row-id={row.id}
      className={row.isBaseline ? "em-baseline-row" : undefined}
    >
      <th
        scope="row"
        className="em-name"
        style={{ paddingLeft: 4 + row.depth * INDENT_PX }}
      >
        <div className="em-name-line">
          {isParent ? (
            <button
              type="button"
              className="em-toggle"
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} rows under ${row.display}`}
              onClick={() => onToggle(row.id)}
            >
              {collapsed ? (
                <ChevronRight fontSize="inherit" />
              ) : (
                <ChevronDown fontSize="inherit" />
              )}
            </button>
          ) : (
            <span className="em-toggle-spacer" aria-hidden="true">
              {row.depth > 0 && <SubdirectoryArrowRight fontSize="inherit" />}
            </span>
          )}
          <span
            className={
              isParent || row.isGroup ? "em-label em-parent" : "em-label"
            }
            title={
              row.runId ? `${row.display} (run ${row.runId})` : row.display
            }
          >
            {row.display}
          </span>
          {isParent && collapsed && (
            <span className="em-muted"> (+{row.childIds.length} hidden)</span>
          )}
        </div>
        {caption && <div className="em-caption">{caption}</div>}
      </th>
      {columns.map((column) => {
        const cell = row.cells[column.name];
        if (!cell) {
          return (
            <td key={column.name}>
              <span
                className="em-none"
                role="img"
                aria-label={`${row.display} ${column.displayName}: no value`}
                title="No value"
              >
                –
              </span>
            </td>
          );
        }
        const tone = toneOf(row.isBaseline, cell.delta);
        const colour = colours[tone];
        const selected = selectedColumn === column.name;
        const value = formatCellValue(cell.value, column.format);
        const description = row.isBaseline
          ? "baseline"
          : cell.delta
            ? deltaDescription(cell.delta)
            : undefined;
        return (
          <td key={column.name}>
            <button
              type="button"
              className={selected ? "em-cell em-selected" : "em-cell"}
              aria-pressed={selected}
              aria-label={`${row.display} ${column.displayName}: ${value}${description ? `, ${description}` : ""}`}
              onClick={() => onSelect(row.id, column.name)}
              style={{ backgroundColor: colour.bg }}
            >
              <span className="em-value">{value}</span>
              {cell.delta && !row.isBaseline && (
                <span className="em-delta" style={{ color: colour.fg }}>
                  <span aria-hidden="true">{deltaGlyph(cell.delta)}</span>{" "}
                  {deltaWord(cell.delta)}
                </span>
              )}
            </button>
          </td>
        );
      })}
    </tr>
  );
});
