import { compareToBaseline, resolveTolerance } from "./delta";
import { DEFAULT_TOLERANCE } from "./eval-matrix-chart-types";

const relative = resolveTolerance({ mode: "relative", same: 0.01, large: 0.1 });
const absolute = resolveTolerance({ mode: "absolute", same: 0.5, large: 2 });

describe("resolveTolerance", () => {
  it("prefers the column, then the panel, then the defaults", () => {
    const panel = { mode: "absolute" as const, same: 1, large: 5 };
    const column = { mode: "relative" as const, same: 0.05, large: 0.2 };
    expect(resolveTolerance(column, panel)).toEqual(column);
    expect(resolveTolerance(undefined, panel)).toEqual(panel);
    expect(resolveTolerance()).toEqual(DEFAULT_TOLERANCE);
  });

  it("fills in `large` and never lets it fall below `same`", () => {
    expect(resolveTolerance({ mode: "relative", same: 0.02 }).large).toBe(0.1);
    expect(resolveTolerance({ mode: "relative", same: 0.3 }).large).toBe(0.3);
    expect(resolveTolerance({ mode: "absolute", same: 0.5 }).large).toBe(5);
    expect(
      resolveTolerance({ mode: "absolute", same: 2, large: 1 }).large,
    ).toBe(2);
  });

  it("treats a negative or non-finite `same` as 0", () => {
    expect(resolveTolerance({ mode: "relative", same: -1 }).same).toBe(0);
    expect(resolveTolerance({ mode: "relative", same: Number.NaN }).same).toBe(
      0,
    );
  });
});

describe("compareToBaseline: higher is better", () => {
  it("calls a rise better", () => {
    expect(compareToBaseline(0.85, 0.8, "higher", relative)).toMatchObject({
      status: "better",
    });
  });

  it("calls a small drop a small regression", () => {
    const d = compareToBaseline(0.76, 0.8, "higher", relative);
    expect(d).toMatchObject({ status: "worse", size: "small" });
    expect(d?.absolute).toBeCloseTo(-0.04);
    expect(d?.relative).toBeCloseTo(-0.05);
  });

  it("calls a big drop a large regression", () => {
    expect(compareToBaseline(0.6, 0.8, "higher", relative)).toMatchObject({
      status: "worse",
      size: "large",
    });
  });

  it("calls a change within tolerance the same, either way", () => {
    expect(compareToBaseline(0.805, 0.8, "higher", relative)?.status).toBe(
      "same",
    );
    expect(compareToBaseline(0.795, 0.8, "higher", relative)?.status).toBe(
      "same",
    );
  });
});

describe("compareToBaseline: lower is better", () => {
  it("calls a drop better", () => {
    expect(compareToBaseline(1.0, 1.2, "lower", relative)).toMatchObject({
      status: "better",
    });
  });

  it("calls a small rise a small regression", () => {
    expect(compareToBaseline(1.25, 1.2, "lower", relative)).toMatchObject({
      status: "worse",
      size: "small",
    });
  });

  it("calls a big rise a large regression", () => {
    const d = compareToBaseline(2.4, 1.2, "lower", relative);
    expect(d).toMatchObject({ status: "worse", size: "large" });
    expect(d?.relative).toBeCloseTo(1);
  });

  it("calls a change within tolerance the same", () => {
    expect(compareToBaseline(1.205, 1.2, "lower", relative)?.status).toBe(
      "same",
    );
  });

  it("treats a rise from zero as a large regression", () => {
    const d = compareToBaseline(0.01, 0, "lower", relative);
    expect(d).toMatchObject({ status: "worse", size: "large" });
    expect(d?.relative).toBeUndefined();
  });

  it("treats a drop to zero as better", () => {
    expect(compareToBaseline(0, 0.02, "lower", relative)?.status).toBe(
      "better",
    );
  });

  it("is the mirror of higher-is-better for the same numbers", () => {
    for (const [value, base] of [
      [1.5, 1],
      [0.5, 1],
      [1.05, 1],
    ] as const) {
      const hi = compareToBaseline(value, base, "higher", relative)!;
      const lo = compareToBaseline(value, base, "lower", relative)!;
      expect(hi.absolute).toBe(lo.absolute);
      expect([hi.status, lo.status].sort()).toEqual(["better", "worse"]);
    }
  });
});

describe("compareToBaseline: absolute tolerance and edges", () => {
  it("uses the column unit in absolute mode", () => {
    expect(compareToBaseline(10.4, 10, "lower", absolute)?.status).toBe("same");
    expect(compareToBaseline(11, 10, "lower", absolute)).toMatchObject({
      status: "worse",
      size: "small",
    });
    expect(compareToBaseline(12, 10, "lower", absolute)).toMatchObject({
      status: "worse",
      size: "large",
    });
  });

  it("counts a change exactly at a bound in spite of float noise", () => {
    // 0.3 - 0.2 is 0.09999999999999998: still at `same` 0.1.
    const t = resolveTolerance({ mode: "absolute", same: 0.1, large: 0.2 });
    expect(compareToBaseline(0.3, 0.2, "higher", t)?.status).toBe("same");
    expect(compareToBaseline(0.1, 0.3, "higher", t)?.size).toBe("large");
  });

  it("uses |baseline| for the relative change of a negative baseline", () => {
    const d = compareToBaseline(-0.5, -1, "higher", relative);
    expect(d?.relative).toBeCloseTo(0.5);
    expect(d?.status).toBe("better");
  });

  it("calls two zeros the same", () => {
    expect(compareToBaseline(0, 0, "higher", relative)).toEqual({
      status: "same",
      absolute: 0,
      relative: 0,
    });
  });

  it("returns undefined for non-finite numbers", () => {
    expect(
      compareToBaseline(Number.NaN, 1, "higher", relative),
    ).toBeUndefined();
    expect(
      compareToBaseline(1, Number.POSITIVE_INFINITY, "lower", relative),
    ).toBeUndefined();
  });
});
