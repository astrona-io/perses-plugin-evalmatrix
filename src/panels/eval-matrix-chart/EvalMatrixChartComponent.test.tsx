import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariableStateMap } from "@perses-dev/plugin-system";
import {
  evalFixture,
  largeFixture,
  queryResults,
  series,
} from "../../test-utils/fixtures";
import { EvalMatrixChartComponent } from "./EvalMatrixChartComponent";
import {
  EvalMatrixChartOptions,
  EvalMatrixChartProps,
} from "./eval-matrix-chart-types";

const MOCK_VARIABLES: VariableStateMap = {
  env: { value: "prod", loading: false },
};

jest.mock("@perses-dev/plugin-system", () => ({
  ...jest.requireActual("@perses-dev/plugin-system"),
  useAllVariableValues: (): VariableStateMap => MOCK_VARIABLES,
}));

const SPEC: EvalMatrixChartOptions = {
  rowLabels: ["model", "prompt_version"],
  columnLabel: "metric",
  baseline: { mode: "row", row: "gpt-ref · v1" },
  sampleSizeQuery: 1,
  columns: [
    { name: "faithfulness", better: "higher" },
    { name: "toxicity", better: "lower" },
    { name: "latency_p95", better: "lower", displayName: "p95 latency" },
    { name: "cost", better: "lower" },
  ],
  cellLink: "https://evals.example.com/${env}/runs/${run_id}?metric=${column}",
};

function asQueryResults(
  results: ReturnType<typeof queryResults>,
): EvalMatrixChartProps["queryResults"] {
  return results.map((r) => ({
    definition: {
      kind: "TimeSeriesQuery",
      spec: { plugin: { kind: "PrometheusTimeSeriesQuery", spec: {} } },
    },
    data: r.data,
  })) as unknown as EvalMatrixChartProps["queryResults"];
}

function renderPanel(
  results: EvalMatrixChartProps["queryResults"],
  spec: EvalMatrixChartOptions = SPEC,
): ReturnType<typeof render> {
  return render(
    <EvalMatrixChartComponent
      spec={spec}
      queryResults={results}
      contentDimensions={{ width: 900, height: 500 }}
    />,
  );
}

const rowNames = (): string[] =>
  screen
    .getAllByRole("rowheader")
    .map((th) => th.querySelector(".em-label")!.textContent!);

describe("EvalMatrixChartComponent", () => {
  it("says there is no data for empty results", () => {
    renderPanel([]);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("explains the expected labels when nothing matches", () => {
    renderPanel(asQueryResults(queryResults([series("up", { job: "x" }, 1)])));
    expect(screen.getByText("No matching series")).toBeInTheDocument();
    expect(screen.getByText("model, prompt_version")).toBeInTheDocument();
  });

  it("does not throw on malformed series", () => {
    const bad = asQueryResults(
      queryResults([
        { name: "x", values: [] },
        {
          name: "y",
          labels: { model: "a", metric: "m" },
          values: [[1, Number.NaN]],
        },
        { name: "z", labels: { model: "a" }, values: [[1, 3]] },
      ]),
    );
    expect(() => renderPanel(bad)).not.toThrow();
  });

  it("draws the baseline row first and the direction in each header", () => {
    renderPanel(asQueryResults(evalFixture()));
    expect(rowNames()).toEqual([
      "gpt-ref · v1",
      "model-a · v2",
      "model-b · v1",
    ]);
    expect(screen.getByText("baseline")).toBeInTheDocument();
    expect(screen.getAllByText("vs run r1")).toHaveLength(2);
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]).toHaveTextContent("faithfulness ↑");
    expect(headers[3]).toHaveTextContent("p95 latency ↓");
    expect(
      within(headers[3]!).getByLabelText("lower is better"),
    ).toBeInTheDocument();
  });

  it("labels each delta with a glyph and a word", () => {
    renderPanel(asQueryResults(evalFixture()));
    expect(
      screen.getByRole("button", {
        name: "model-a · v2 faithfulness: 0.85, better",
      }),
    ).toHaveTextContent("0.85▲ better");
    expect(
      screen.getByRole("button", {
        name: "model-b · v1 p95 latency: 2.4, worse (large regression)",
      }),
    ).toHaveTextContent("▼ worse");
    expect(
      screen.getByRole("button", { name: "model-a · v2 toxicity: 0.02, same" }),
    ).toHaveTextContent("= same");
    expect(
      screen.getByRole("button", {
        name: "gpt-ref · v1 faithfulness: 0.8, baseline",
      }),
    ).not.toHaveTextContent("better");
  });

  it("opens the detail strip with change, sample size, run and link", async () => {
    const user = userEvent.setup();
    renderPanel(asQueryResults(evalFixture()));
    await user.click(
      screen.getByRole("button", { name: /^model-b · v1 p95 latency/ }),
    );
    const strip = screen.getByRole("region", {
      name: "Details: model-b · v1 p95 latency",
    });
    expect(
      within(strip).getByText("1.2 (gpt-ref · v1, run r1)"),
    ).toBeInTheDocument();
    expect(within(strip).getByText("+1.2")).toBeInTheDocument();
    expect(within(strip).getByText("+100%")).toBeInTheDocument();
    expect(
      within(strip).getByText(/worse \(large regression\)/),
    ).toHaveTextContent("lower is better");
    expect(within(strip).getByText("450 (baseline 500)")).toBeInTheDocument();
    expect(within(strip).getByText("r3")).toBeInTheDocument();
    expect(
      within(strip).getByRole("link", { name: "Open failing cases" }),
    ).toHaveAttribute(
      "href",
      "https://evals.example.com/prod/runs/r3?metric=latency_p95",
    );
    await user.click(
      within(strip).getByRole("button", { name: "Close details" }),
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("drops an unsafe cell link", async () => {
    const user = userEvent.setup();
    renderPanel(asQueryResults(evalFixture()), {
      ...SPEC,
      cellLink: "javascript:alert('${row}')",
    });
    await user.click(
      screen.getByRole("button", { name: /^model-a · v2 cost/ }),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("works from the keyboard", async () => {
    const user = userEvent.setup();
    renderPanel(asQueryResults(evalFixture()));
    const cell = screen.getByRole("button", {
      name: /^model-a · v2 faithfulness/,
    });
    cell.focus();
    await user.keyboard("{Enter}");
    expect(cell).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(cell).toHaveAttribute("aria-pressed", "false");
  });

  it("sorts by a column, best first, keeping the baseline on top", async () => {
    const user = userEvent.setup();
    renderPanel(asQueryResults(evalFixture()));
    const latency = screen.getByRole("button", { name: /^p95 latency/ });
    await user.click(latency);
    expect(rowNames()).toEqual([
      "gpt-ref · v1",
      "model-a · v2",
      "model-b · v1",
    ]);
    expect(latency.closest("th")).toHaveAttribute("aria-sort", "ascending");
    await user.click(latency);
    expect(rowNames()).toEqual([
      "gpt-ref · v1",
      "model-b · v1",
      "model-a · v2",
    ]);
    await user.click(screen.getByRole("button", { name: /^faithfulness/ }));
    expect(rowNames()).toEqual([
      "gpt-ref · v1",
      "model-a · v2",
      "model-b · v1",
    ]);
  });

  it("notes a missing baseline row", () => {
    renderPanel(asQueryResults(evalFixture()), {
      ...SPEC,
      baseline: { mode: "row", row: "nope" },
    });
    expect(
      screen.getByText('Baseline row "nope" is not in the data'),
    ).toBeInTheDocument();
  });

  it("collapses a row tree", async () => {
    const user = userEvent.setup();
    renderPanel(
      asQueryResults(
        queryResults([
          series(
            "flow_rate",
            { source: "kube-system", cluster: "c1", destination: "web" },
            3,
          ),
          series(
            "flow_rate",
            { source: "web", cluster: "c1", destination: "db" },
            5,
          ),
        ]),
      ),
      { rowLabels: ["source"], columnLabel: "destination", rowTree: "cluster" },
    );
    expect(rowNames()).toEqual(["c1", "kube-system", "web"]);
    await user.click(
      screen.getByRole("button", { name: "Collapse rows under c1" }),
    );
    expect(rowNames()).toEqual(["c1"]);
    expect(screen.getByText("(+2 hidden)")).toBeInTheDocument();
  });

  it("renders 200 rows x 12 columns quickly", () => {
    const started = performance.now();
    renderPanel(asQueryResults(queryResults(largeFixture(200, 12))), {
      rowLabels: ["model", "prompt_version"],
      columnLabel: "metric",
      baseline: { mode: "previousRun" },
    });
    const elapsed = performance.now() - started;
    expect(screen.getAllByRole("rowheader")).toHaveLength(200);
    expect(screen.getAllByRole("columnheader")).toHaveLength(13);
    expect(elapsed).toBeLessThan(5000);
  });
});
