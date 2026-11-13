import {
  evalFixture,
  queryResults,
  series,
  T0,
} from "../../test-utils/fixtures";
import {
  arrangeRows,
  buildModel,
  defaultSortDirection,
  GROUP_PREFIX,
  lastSample,
  resolveColumns,
  visibleRows,
} from "./data";
import { EvalMatrixChartOptions } from "./eval-matrix-chart-types";

const EVAL_OPTIONS: EvalMatrixChartOptions = {
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
};

describe("lastSample", () => {
  it("takes the last finite sample and the first one's time", () => {
    expect(
      lastSample({
        name: "x",
        values: [
          [1, 5],
          [2, 6],
          [3, Number.NaN],
        ],
      }),
    ).toEqual({ value: 6, at: 2, firstAt: 1 });
    expect(lastSample({ name: "x", values: [] })).toBeUndefined();
  });
});

describe("resolveColumns", () => {
  it("puts listed columns first, then the rest alphabetically with defaults", () => {
    const cols = resolveColumns(["z", "b", "a"], {
      columns: [{ name: "z", better: "lower" }, { name: "missing" }],
    });
    expect(cols.map((c) => c.name)).toEqual(["z", "missing", "a", "b"]);
    expect(cols[0]!.better).toBe("lower");
    expect(cols[2]!.better).toBe("higher");
  });
});

describe("buildModel", () => {
  it("reports no data and no matching series", () => {
    expect(buildModel([], EVAL_OPTIONS).status).toBe("no-data");
    const m = buildModel(
      queryResults([series("up", { job: "x" }, 1)]),
      EVAL_OPTIONS,
    );
    expect(m.status).toBe("no-match");
    expect(m.ignoredSeries).toBe(1);
  });

  it("builds rows, columns, the baseline and direction-aware deltas", () => {
    const m = buildModel(evalFixture(), EVAL_OPTIONS);
    expect(m.status).toBe("ok");
    expect(m.baselineRowId).toBe("gpt-ref · v1");
    expect(m.columns.map((c) => c.displayName)).toEqual([
      "faithfulness",
      "toxicity",
      "p95 latency",
      "cost",
    ]);
    const a = m.rowsById.get("model-a · v2")!;
    expect(a.cells.faithfulness!.delta?.status).toBe("better");
    expect(a.cells.toxicity!.delta?.status).toBe("same");
    expect(a.cells.latency_p95!.delta).toMatchObject({
      status: "worse",
      size: "small",
    });
    expect(a.cells.cost!.delta?.status).toBe("same");
    expect(a.sampleSize).toBe(480);
    expect(a.baselineSampleSize).toBe(500);
    expect(a.baselineRunId).toBe("r1");

    const b = m.rowsById.get("model-b · v1")!;
    expect(b.cells.latency_p95!.delta).toMatchObject({
      status: "worse",
      size: "large",
    });
    expect(b.cells.toxicity!.delta?.size).toBe("large");
    expect(b.cells.faithfulness!.delta?.size).toBe("small");

    const ref = m.rowsById.get("gpt-ref · v1")!;
    expect(ref.isBaseline).toBe(true);
    expect(ref.cells.faithfulness!.delta).toBeUndefined();
    expect(m.rootIds).not.toContain(ref.id);
  });

  it("takes the first row by name when no baseline row is set", () => {
    const m = buildModel(evalFixture(), {
      ...EVAL_OPTIONS,
      baseline: { mode: "row" },
    });
    expect(m.baselineRowId).toBe("gpt-ref · v1");
  });

  it("notes a baseline row that is not in the data and compares nothing", () => {
    const m = buildModel(evalFixture(), {
      ...EVAL_OPTIONS,
      baseline: { mode: "row", row: "nope" },
    });
    expect(m.notes).toEqual(['Baseline row "nope" is not in the data']);
    expect(m.baselineRowId).toBeUndefined();
    expect(
      m.rowsById.get("model-a · v2")!.cells.faithfulness!.delta,
    ).toBeUndefined();
  });

  it("shows values only without a baseline", () => {
    const m = buildModel(evalFixture(), {
      ...EVAL_OPTIONS,
      baseline: undefined,
    });
    expect(m.baselineRowId).toBeUndefined();
    expect(m.rootIds).toHaveLength(3);
    expect(m.rowsById.get("model-b · v1")!.cells.cost!.delta).toBeUndefined();
  });

  it("shows the newest run and compares it with the previous one", () => {
    const s = (run: string, value: number, at: number) =>
      series(
        "llm_eval_score",
        { model: "m", prompt_version: "v1", metric: "latency", run_id: run },
        value,
        at,
      );
    const m = buildModel(
      queryResults([s("r10", 2, T0), s("r9", 1, T0 - 60_000)]),
      {
        ...EVAL_OPTIONS,
        columns: [{ name: "latency", better: "lower" }],
        baseline: { mode: "previousRun" },
      },
    );
    const row = m.rowsById.get("m · v1")!;
    expect(row.runId).toBe("r10");
    expect(row.baselineRunId).toBe("r9");
    expect(row.cells.latency).toMatchObject({
      value: 2,
      baseline: 1,
      delta: { status: "worse", size: "large" },
    });
  });

  it("orders runs that start together by run id, numerically", () => {
    const s = (run: string, value: number) =>
      series(
        "llm_eval_score",
        { model: "m", prompt_version: "v1", metric: "x", run_id: run },
        value,
      );
    const m = buildModel(queryResults([s("run-10", 3), s("run-9", 2)]), {
      ...EVAL_OPTIONS,
      baseline: { mode: "previousRun" },
    });
    expect(m.rowsById.get("m · v1")!.runId).toBe("run-10");
  });

  it("ignores series without the column label or any row label", () => {
    const m = buildModel(
      queryResults([
        series("llm_eval_score", { model: "a", metric: "x" }, 1),
        series("llm_eval_score", { model: "b" }, 1),
        series("llm_eval_score", { metric: "x" }, 1),
        {
          name: "nan",
          labels: { model: "c", metric: "x" },
          values: [[1, Number.NaN]],
        },
      ]),
      { rowLabels: ["model", "prompt_version"], columnLabel: "metric" },
    );
    expect([...m.rowsById.keys()]).toEqual(["a · –"]);
    expect(m.ignoredSeries).toBe(2);
  });

  it("nests rows under their parent row or a group, and breaks cycles", () => {
    const s = (src: string, parent: string) =>
      series("flow_rate", { source: src, cluster: parent, dest: "d" }, 1);
    const m = buildModel(
      queryResults([
        s("base", ""),
        s("child", "base"),
        s("grandchild", "child"),
        s("x", "group-1"),
        s("loop-a", "loop-b"),
        s("loop-b", "loop-a"),
      ]),
      { rowLabels: ["source"], columnLabel: "dest", rowTree: "cluster" },
    );
    expect(m.rowsById.get("child")!.parentId).toBe("base");
    expect(m.rowsById.get("grandchild")!.depth).toBe(2);
    const group = m.rowsById.get(GROUP_PREFIX + "group-1")!;
    expect(group.isGroup).toBe(true);
    expect(group.childIds).toEqual(["x"]);
    const loopRoots = ["loop-a", "loop-b"].filter((id) =>
      m.rootIds.includes(id),
    );
    expect(loopRoots.length).toBeGreaterThan(0);
  });
});

describe("arrangeRows and visibleRows", () => {
  const model = buildModel(evalFixture(), EVAL_OPTIONS);

  it("pins the baseline on top and sorts the rest", () => {
    const byName = arrangeRows(model, { direction: "asc" }).map((r) => r.id);
    expect(byName).toEqual(["gpt-ref · v1", "model-a · v2", "model-b · v1"]);
    const byLatency = arrangeRows(model, {
      column: "latency_p95",
      direction: "desc",
    }).map((r) => r.id);
    expect(byLatency).toEqual(["gpt-ref · v1", "model-b · v1", "model-a · v2"]);
  });

  it("puts rows without a value last in either direction", () => {
    const m = buildModel(
      queryResults([
        series("s", { model: "a", metric: "x" }, 1),
        series("s", { model: "b", metric: "y" }, 1),
        series("s", { model: "c", metric: "x" }, 2),
      ]),
      { rowLabels: ["model"], columnLabel: "metric" },
    );
    for (const direction of ["asc", "desc"] as const) {
      const ids = arrangeRows(m, { column: "x", direction }).map((r) => r.id);
      expect(ids[2]).toBe("b");
    }
  });

  it("starts a column sort with the best values first", () => {
    expect(defaultSortDirection(model.columns[0])).toBe("desc");
    expect(defaultSortDirection(model.columns[1])).toBe("asc");
    expect(defaultSortDirection(undefined)).toBe("asc");
  });

  it("hides rows under collapsed parents", () => {
    const m = buildModel(
      queryResults([
        series("f", { source: "p", parent: "", dest: "d" }, 1),
        series("f", { source: "c1", parent: "p", dest: "d" }, 1),
        series("f", { source: "c2", parent: "p", dest: "d" }, 1),
        series("f", { source: "q", parent: "", dest: "d" }, 1),
      ]),
      { rowLabels: ["source"], columnLabel: "dest", rowTree: "parent" },
    );
    const rows = arrangeRows(m, { direction: "asc" });
    expect(rows.map((r) => r.id)).toEqual(["p", "c1", "c2", "q"]);
    expect(visibleRows(rows, new Set(["p"])).map((r) => r.id)).toEqual([
      "p",
      "q",
    ]);
  });
});
