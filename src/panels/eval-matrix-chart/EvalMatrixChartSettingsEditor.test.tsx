import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EvalMatrixChartSettingsEditor,
  parseList,
  parseNonNegative,
} from "./EvalMatrixChartSettingsEditor";
import {
  createInitialEvalMatrixChartOptions,
  EvalMatrixChartOptions,
} from "./eval-matrix-chart-types";

function renderEditor(value: EvalMatrixChartOptions): jest.Mock {
  const onChange = jest.fn();
  render(<EvalMatrixChartSettingsEditor value={value} onChange={onChange} />);
  return onChange;
}

const lastCall = (onChange: jest.Mock): EvalMatrixChartOptions =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0];

const blurWith = (label: string, text: string): void => {
  const input = screen
    .getAllByLabelText(label)
    .find((el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  if (!input) throw new Error(`no input labelled ${label}`);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
};

async function choose(
  label: string,
  option: string,
  group?: string,
): Promise<void> {
  const user = userEvent.setup();
  const scope = group
    ? within(screen.getByRole("group", { name: group }))
    : screen;
  await user.click(scope.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
}

describe("parsers", () => {
  it("parses a comma list, trimmed and without duplicates", () => {
    expect(parseList(" model, prompt_version,,model ")).toEqual([
      "model",
      "prompt_version",
    ]);
    expect(parseList(" ")).toEqual([]);
  });

  it("parses non-negative numbers", () => {
    expect(parseNonNegative("0.05")).toBe(0.05);
    expect(parseNonNegative("")).toBeUndefined();
    expect(parseNonNegative("-1")).toBeUndefined();
    expect(parseNonNegative("x")).toBeUndefined();
  });
});

describe("EvalMatrixChartSettingsEditor", () => {
  const initial = createInitialEvalMatrixChartOptions();

  it("starts from the documented defaults", () => {
    expect(initial).toEqual({
      rowLabels: ["model", "prompt_version"],
      columnLabel: "metric",
      baseline: { mode: "row" },
      tolerance: { mode: "relative", same: 0.01, large: 0.1 },
    });
  });

  it("writes the data options", () => {
    const onChange = renderEditor(initial);
    blurWith("Row labels", "source_namespace");
    expect(lastCall(onChange).rowLabels).toEqual(["source_namespace"]);
    blurWith("Column label", " destination_namespace ");
    expect(lastCall(onChange).columnLabel).toBe("destination_namespace");
    blurWith("Run label", "window");
    expect(lastCall(onChange).runLabel).toBe("window");
    blurWith("Row tree label", "base_image");
    expect(lastCall(onChange).rowTree).toBe("base_image");
    blurWith("Sample size query", "1");
    expect(lastCall(onChange).sampleSizeQuery).toBe(1);
  });

  it("removes an option that is cleared", () => {
    const onChange = renderEditor({ ...initial, runLabel: "window" });
    blurWith("Run label", " ");
    expect(lastCall(onChange)).not.toHaveProperty("runLabel");
  });

  it("writes the baseline mode and row", async () => {
    const onChange = renderEditor(initial);
    blurWith("Baseline row", "gpt-ref · v1");
    expect(lastCall(onChange).baseline).toEqual({
      mode: "row",
      row: "gpt-ref · v1",
    });
    await choose("Compare with", "Each row's previous run");
    expect(lastCall(onChange).baseline).toEqual({ mode: "previousRun" });
    await choose("Compare with", "Nothing");
    expect(lastCall(onChange)).not.toHaveProperty("baseline");
  });

  it("writes the panel tolerance", async () => {
    const onChange = renderEditor(initial);
    blurWith("Tolerance same up to", "0.02");
    expect(lastCall(onChange).tolerance).toEqual({
      mode: "relative",
      same: 0.02,
      large: 0.1,
    });
    blurWith("Tolerance large from", "");
    expect(lastCall(onChange).tolerance).toEqual({
      mode: "relative",
      same: 0.01,
    });
    await choose("Mode", "absolute", "Tolerance");
    expect(lastCall(onChange).tolerance?.mode).toBe("absolute");
  });

  it("writes the link", () => {
    const onChange = renderEditor(initial);
    blurWith("Cell link", "https://e.example.com/${run_id}");
    expect(lastCall(onChange).cellLink).toBe("https://e.example.com/${run_id}");
    blurWith("Link text", "Open traces");
    expect(lastCall(onChange).cellLinkLabel).toBe("Open traces");
  });

  it("adds a column", async () => {
    const user = userEvent.setup();
    const onChange = renderEditor(initial);
    await user.click(screen.getByRole("button", { name: "Add column" }));
    expect(lastCall(onChange).columns).toEqual([{ name: "" }]);
  });

  it("edits a listed column", async () => {
    const value: EvalMatrixChartOptions = {
      ...initial,
      columns: [{ name: "latency" }, { name: "cost" }],
    };
    const onChange = renderEditor(value);
    blurWith("latency header", "p95 latency");
    expect(lastCall(onChange).columns![0]).toEqual({
      name: "latency",
      displayName: "p95 latency",
    });
    await choose("Better", "lower ↓", "Column latency");
    expect(lastCall(onChange).columns![0]).toEqual({
      name: "latency",
      better: "lower",
    });
    fireEvent.click(screen.getByLabelText("cost own tolerance"));
    expect(lastCall(onChange).columns![1]!.tolerance).toEqual({
      mode: "relative",
      same: 0.01,
      large: 0.1,
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove latency" }));
    expect(lastCall(onChange).columns).toEqual([{ name: "cost" }]);
    const fieldset = screen.getByRole("group", { name: "Column cost" });
    expect(within(fieldset).getByLabelText("cost name")).toHaveValue("cost");
  });

  it("removes the columns option with the last column", () => {
    const onChange = renderEditor({ ...initial, columns: [{ name: "x" }] });
    fireEvent.click(screen.getByRole("button", { name: "Remove x" }));
    expect(lastCall(onChange)).not.toHaveProperty("columns");
  });
});
