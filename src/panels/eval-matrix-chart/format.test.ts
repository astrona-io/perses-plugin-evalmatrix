import {
  deltaDescription,
  deltaGlyph,
  formatAbsoluteChange,
  formatCellValue,
  formatRelativeChange,
} from "./format";

describe("format", () => {
  it("formats values with the column format or plain decimals", () => {
    expect(formatCellValue(0.8)).toBe("0.8");
    expect(formatCellValue(0.8123, { unit: "percent-decimal" })).toMatch(
      /^81(\.2)?%$/,
    );
    expect(formatCellValue(Number.NaN)).toBe("NaN");
  });

  it("gives percent changes in percentage points", () => {
    expect(formatAbsoluteChange(0.026, { unit: "percent-decimal" })).toBe(
      "+2.6 pp",
    );
    expect(formatAbsoluteChange(-12, { unit: "percent" })).toBe("−12 pp");
    expect(
      formatAbsoluteChange(0.5, { unit: "percent", decimalPlaces: 2 }),
    ).toBe("+0.50 pp");
  });

  it("signs other changes and formats their size", () => {
    expect(formatAbsoluteChange(0.05)).toBe("+0.05");
    expect(formatAbsoluteChange(-0.05)).toBe("−0.05");
    expect(formatAbsoluteChange(0)).toBe("±0");
  });

  it("formats the relative change as a signed percentage", () => {
    expect(formatRelativeChange(2.17)).toBe("+217%");
    expect(formatRelativeChange(-0.081)).toBe("−8.1%");
    expect(formatRelativeChange(undefined)).toBe("n/a");
  });

  it("describes a delta with a glyph and words", () => {
    const worse = {
      status: "worse" as const,
      size: "large" as const,
      absolute: 1,
    };
    expect(deltaGlyph(worse)).toBe("▼");
    expect(deltaDescription(worse)).toBe("worse (large regression)");
    expect(deltaGlyph({ status: "better", absolute: 1 })).toBe("▲");
    expect(deltaGlyph({ status: "same", absolute: 0 })).toBe("=");
    expect(
      deltaDescription({ status: "worse", size: "small", absolute: 1 }),
    ).toBe("worse (small regression)");
  });
});
