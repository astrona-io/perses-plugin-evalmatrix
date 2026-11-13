import { TimeSeries, TimeSeriesData } from "@perses-dev/spec";

/** Builders for query results shaped like the metric contract in docs/metrics.md. */

export const T0 = 1_760_000_000_000;

export function series(
  name: string,
  labels: Record<string, string>,
  value: number,
  at = T0,
): TimeSeries {
  return {
    name,
    labels: { __name__: name, ...labels },
    values: [[at, value]],
  };
}

export interface EvalRun {
  model: string;
  prompt: string;
  runId: string;
  scores: Record<string, number>;
  cases?: number;
  at?: number;
}

export function evalScores(run: EvalRun): TimeSeries[] {
  const id = {
    model: run.model,
    prompt_version: run.prompt,
    run_id: run.runId,
  };
  return Object.entries(run.scores).map(([metric, value]) =>
    series("llm_eval_score", { ...id, metric }, value, run.at ?? T0),
  );
}

export function evalCases(run: EvalRun): TimeSeries[] {
  if (run.cases === undefined) return [];
  return [
    series(
      "llm_eval_cases_total",
      { model: run.model, prompt_version: run.prompt, run_id: run.runId },
      run.cases,
      run.at ?? T0,
    ),
  ];
}

export function queryResults(
  ...seriesLists: TimeSeries[][]
): Array<{ data: TimeSeriesData }> {
  return seriesLists.map((list) => ({
    data: {
      series: list,
      timeRange: { start: new Date(T0 - 3_600_000), end: new Date(T0) },
      stepMs: 15_000,
    },
  }));
}

/** gpt-ref is the baseline; model-a improves faithfulness, model-b regresses on latency and cost. */
export const EVAL_RUNS: EvalRun[] = [
  {
    model: "gpt-ref",
    prompt: "v1",
    runId: "r1",
    scores: { faithfulness: 0.8, toxicity: 0.02, latency_p95: 1.2, cost: 0.01 },
    cases: 500,
  },
  {
    model: "model-a",
    prompt: "v2",
    runId: "r2",
    scores: {
      faithfulness: 0.85,
      toxicity: 0.02,
      latency_p95: 1.25,
      cost: 0.0101,
    },
    cases: 480,
  },
  {
    model: "model-b",
    prompt: "v1",
    runId: "r3",
    scores: {
      faithfulness: 0.78,
      toxicity: 0.03,
      latency_p95: 2.4,
      cost: 0.02,
    },
    cases: 450,
  },
];

export function evalFixture(): Array<{ data: TimeSeriesData }> {
  return queryResults(
    EVAL_RUNS.flatMap(evalScores),
    EVAL_RUNS.flatMap(evalCases),
  );
}

/** `rows` × `columns` matrix with two runs per row. */
export function largeFixture(rows = 200, columns = 12): TimeSeries[] {
  const out: TimeSeries[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      for (const [run, at] of [
        ["r1", T0 - 60_000],
        ["r2", T0],
      ] as const) {
        out.push(
          series(
            "llm_eval_score",
            {
              model: `model-${String(i).padStart(3, "0")}`,
              prompt_version: "v1",
              metric: `m${String(j).padStart(2, "0")}`,
              run_id: run,
            },
            ((i * 7 + j * 3) % 100) / 100 + (run === "r2" ? (i % 5) / 50 : 0),
            at,
          ),
        );
      }
    }
  }
  return out;
}
