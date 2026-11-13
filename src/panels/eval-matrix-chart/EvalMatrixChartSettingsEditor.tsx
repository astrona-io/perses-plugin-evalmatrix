import { ReactElement } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  FormatControls,
  OptionsEditorColumn,
  OptionsEditorControl,
  OptionsEditorGrid,
  OptionsEditorGroup,
} from "@perses-dev/components";
import Delete from "mdi-material-ui/Delete";
import Plus from "mdi-material-ui/Plus";
import {
  BaselineMode,
  Better,
  ColumnOptions,
  DEFAULT_BETTER,
  DEFAULT_CELL_LINK_LABEL,
  DEFAULT_RUN_LABEL,
  DEFAULT_TOLERANCE,
  EvalMatrixChartEditorProps,
  EvalMatrixChartOptions,
  Tolerance,
  ToleranceMode,
} from "./eval-matrix-chart-types";
import { DEFAULT_FORMAT } from "./format";

/** `"model, prompt_version"` to `["model", "prompt_version"]`; duplicates and blanks dropped. */
export function parseList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** A number from a text field; undefined when blank or not a number ≥ 0. */
export function parseNonNegative(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const trimmed = (text: string): string | undefined => text.trim() || undefined;

interface ToleranceFieldsProps {
  value: Tolerance;
  label: string;
  onChange: (t: Tolerance) => void;
}

function ToleranceFields({
  value,
  label,
  onChange,
}: ToleranceFieldsProps): ReactElement {
  const unit =
    value.mode === "relative" ? "fraction, 0.02 = 2 %" : "column unit";
  return (
    <Stack direction="row" spacing={1} role="group" aria-label={label}>
      <TextField
        select
        size="small"
        label="Mode"
        value={value.mode}
        onChange={(e) =>
          onChange({ ...value, mode: e.target.value as ToleranceMode })
        }
        sx={{ minWidth: 110 }}
      >
        <MenuItem value="relative">relative</MenuItem>
        <MenuItem value="absolute">absolute</MenuItem>
      </TextField>
      <TextField
        key={`same-${value.same}`}
        size="small"
        label="Same up to"
        type="number"
        defaultValue={value.same}
        helperText={unit}
        inputProps={{
          min: 0,
          step: "any",
          "aria-label": `${label} same up to`,
        }}
        onBlur={(e) => {
          const same = parseNonNegative(e.target.value);
          if (same !== undefined) onChange({ ...value, same });
        }}
      />
      <TextField
        key={`large-${value.large ?? ""}`}
        size="small"
        label="Large from"
        type="number"
        defaultValue={value.large ?? ""}
        helperText={unit}
        inputProps={{
          min: 0,
          step: "any",
          "aria-label": `${label} large from`,
        }}
        onBlur={(e) => {
          const large = parseNonNegative(e.target.value);
          const next: Tolerance = { ...value };
          if (large === undefined) delete next.large;
          else next.large = large;
          onChange(next);
        }}
      />
    </Stack>
  );
}

interface ColumnEditorProps {
  column: ColumnOptions;
  index: number;
  onChange: (column: ColumnOptions) => void;
  onRemove: () => void;
}

function ColumnEditor({
  column,
  index,
  onChange,
  onRemove,
}: ColumnEditorProps): ReactElement {
  const label = column.name || `Column ${index + 1}`;
  return (
    <Box
      component="fieldset"
      aria-label={`Column ${label}`}
      sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1, m: 0 }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            key={`name-${column.name}`}
            size="small"
            label="Name"
            defaultValue={column.name}
            inputProps={{ "aria-label": `${label} name` }}
            onBlur={(e) => onChange({ ...column, name: e.target.value.trim() })}
          />
          <TextField
            key={`display-${column.displayName ?? ""}`}
            size="small"
            label="Header"
            defaultValue={column.displayName ?? ""}
            inputProps={{ "aria-label": `${label} header` }}
            onBlur={(e) =>
              onChange({ ...column, displayName: trimmed(e.target.value) })
            }
          />
          <TextField
            select
            size="small"
            label="Better"
            value={column.better ?? DEFAULT_BETTER}
            onChange={(e) =>
              onChange({ ...column, better: e.target.value as Better })
            }
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="higher">higher ↑</MenuItem>
            <MenuItem value="lower">lower ↓</MenuItem>
          </TextField>
          <IconButton aria-label={`Remove ${label}`} onClick={onRemove}>
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
        <FormatControls
          value={column.format ?? DEFAULT_FORMAT}
          onChange={(format) => onChange({ ...column, format })}
        />
        <FormControlLabel
          label="Own tolerance"
          control={
            <Switch
              size="small"
              checked={column.tolerance !== undefined}
              inputProps={{ "aria-label": `${label} own tolerance` }}
              onChange={(_, on) => {
                const next = { ...column };
                if (on) next.tolerance = { ...DEFAULT_TOLERANCE };
                else delete next.tolerance;
                onChange(next);
              }}
            />
          }
        />
        {column.tolerance && (
          <ToleranceFields
            label={`${label} tolerance`}
            value={column.tolerance}
            onChange={(tolerance) => onChange({ ...column, tolerance })}
          />
        )}
      </Stack>
    </Box>
  );
}

export function EvalMatrixChartSettingsEditor(
  props: EvalMatrixChartEditorProps,
): ReactElement {
  const { onChange, value } = props;
  const set = (patch: Partial<EvalMatrixChartOptions>): void => {
    const next: EvalMatrixChartOptions = { ...value, ...patch };
    for (const key of Object.keys(patch) as Array<
      keyof EvalMatrixChartOptions
    >) {
      if (next[key] === undefined) delete next[key];
    }
    onChange(next);
  };

  const columns = value.columns ?? [];
  const setColumns = (next: ColumnOptions[]): void =>
    set({ columns: next.length ? next : undefined });
  const baselineMode: BaselineMode | "none" = value.baseline?.mode ?? "none";

  return (
    <OptionsEditorGrid>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Data">
          <OptionsEditorControl
            label="Row labels"
            description="Comma-separated label names; their values make a row"
            control={
              <TextField
                key={value.rowLabels.join(",")}
                size="small"
                placeholder="model, prompt_version"
                defaultValue={value.rowLabels.join(", ")}
                inputProps={{ "aria-label": "Row labels" }}
                onBlur={(e) => set({ rowLabels: parseList(e.target.value) })}
              />
            }
          />
          <OptionsEditorControl
            label="Column label"
            description="The label whose values are the columns"
            control={
              <TextField
                key={value.columnLabel}
                size="small"
                placeholder="metric"
                defaultValue={value.columnLabel}
                inputProps={{ "aria-label": "Column label" }}
                onBlur={(e) => set({ columnLabel: e.target.value.trim() })}
              />
            }
          />
          <OptionsEditorControl
            label="Run label"
            description={`Tells runs apart; each row shows its newest run. Default ${DEFAULT_RUN_LABEL}`}
            control={
              <TextField
                key={value.runLabel ?? ""}
                size="small"
                placeholder={DEFAULT_RUN_LABEL}
                defaultValue={value.runLabel ?? ""}
                inputProps={{ "aria-label": "Run label" }}
                onBlur={(e) => set({ runLabel: trimmed(e.target.value) })}
              />
            }
          />
          <OptionsEditorControl
            label="Row tree label"
            description="Label naming a row's parent: the row with that key, or a group"
            control={
              <TextField
                key={value.rowTree ?? ""}
                size="small"
                placeholder="base_image"
                defaultValue={value.rowTree ?? ""}
                inputProps={{ "aria-label": "Row tree label" }}
                onBlur={(e) => set({ rowTree: trimmed(e.target.value) })}
              />
            }
          />
          <OptionsEditorControl
            label="Sample size query"
            description="Index (from 0) of the query giving the sample size per row and run"
            control={
              <TextField
                key={value.sampleSizeQuery ?? ""}
                size="small"
                type="number"
                defaultValue={value.sampleSizeQuery ?? ""}
                inputProps={{ min: 0, "aria-label": "Sample size query" }}
                onBlur={(e) => {
                  const n = parseNonNegative(e.target.value);
                  set({
                    sampleSizeQuery:
                      n === undefined ? undefined : Math.floor(n),
                  });
                }}
              />
            }
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Baseline">
          <OptionsEditorControl
            label="Compare with"
            control={
              <TextField
                select
                size="small"
                value={baselineMode}
                inputProps={{ "aria-label": "Compare with" }}
                onChange={(e) => {
                  const mode = e.target.value as BaselineMode | "none";
                  set({
                    baseline:
                      mode === "none"
                        ? undefined
                        : mode === "row"
                          ? { mode, row: value.baseline?.row }
                          : { mode },
                  });
                }}
              >
                <MenuItem value="none">Nothing</MenuItem>
                <MenuItem value="row">A baseline row</MenuItem>
                <MenuItem value="previousRun">
                  Each row&apos;s previous run
                </MenuItem>
              </TextField>
            }
          />
          {baselineMode === "row" && (
            <OptionsEditorControl
              label="Baseline row"
              description="The row's key, label values joined with ' · '. First row when empty"
              control={
                <TextField
                  key={value.baseline?.row ?? ""}
                  size="small"
                  placeholder="gpt-4o · v1"
                  defaultValue={value.baseline?.row ?? ""}
                  inputProps={{ "aria-label": "Baseline row" }}
                  onBlur={(e) =>
                    set({
                      baseline: { mode: "row", row: trimmed(e.target.value) },
                    })
                  }
                />
              }
            />
          )}
          <Typography variant="caption" color="text.secondary" component="p">
            Tolerance: a change up to &quot;same up to&quot; counts as the same;
            a regression from &quot;large from&quot; is red, smaller ones amber.
          </Typography>
          <ToleranceFields
            label="Tolerance"
            value={value.tolerance ?? DEFAULT_TOLERANCE}
            onChange={(tolerance) => set({ tolerance })}
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Link">
          <OptionsEditorControl
            label="Cell link"
            description="Variables: ${row} ${column} ${run_id} ${baseline_row} ${baseline_run_id}, and dashboard variables"
            control={
              <TextField
                key={value.cellLink ?? ""}
                size="small"
                placeholder="https://evals.example.com/runs/${run_id}?metric=${column}&failed=1"
                defaultValue={value.cellLink ?? ""}
                inputProps={{ "aria-label": "Cell link" }}
                onBlur={(e) => set({ cellLink: trimmed(e.target.value) })}
              />
            }
          />
          <OptionsEditorControl
            label="Link text"
            control={
              <TextField
                key={value.cellLinkLabel ?? ""}
                size="small"
                placeholder={DEFAULT_CELL_LINK_LABEL}
                defaultValue={value.cellLinkLabel ?? ""}
                inputProps={{ "aria-label": "Link text" }}
                onBlur={(e) => set({ cellLinkLabel: trimmed(e.target.value) })}
              />
            }
          />
        </OptionsEditorGroup>
      </OptionsEditorColumn>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Columns">
          <Typography variant="caption" color="text.secondary" component="p">
            Listed columns come first, in this order, even without data. Other
            columns follow alphabetically: higher is better, panel tolerance.
          </Typography>
          <Stack spacing={1}>
            {columns.map((column, i) => (
              <ColumnEditor
                key={i}
                index={i}
                column={column}
                onChange={(c) =>
                  setColumns(columns.map((old, j) => (j === i ? c : old)))
                }
                onRemove={() => setColumns(columns.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              size="small"
              startIcon={<Plus />}
              onClick={() => setColumns([...columns, { name: "" }])}
            >
              Add column
            </Button>
          </Stack>
        </OptionsEditorGroup>
      </OptionsEditorColumn>
    </OptionsEditorGrid>
  );
}
