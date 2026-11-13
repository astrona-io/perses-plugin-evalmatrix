import { interpolate, isSafeHref, resolveCellLink } from "./links";

const context = {
  row: "model-a · v2",
  column: "faithfulness",
  run_id: "r 2",
  baseline_row: "gpt-ref · v1",
};

describe("links", () => {
  it("fills in known variables, URL-encoded", () => {
    expect(interpolate("/runs/${run_id}?m=${column}&r=${row}", context)).toBe(
      "/runs/r%202?m=faithfulness&r=model-a%20%C2%B7%20v2",
    );
  });

  it("leaves unknown variables for Perses and empties missing known ones", () => {
    expect(interpolate("${env}/${baseline_run_id}/x", context)).toBe(
      "${env}//x",
    );
  });

  it("only allows http(s) and relative links", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("/relative")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref(" data:text/html,x")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });

  it("resolves the cell link with dashboard variables", () => {
    expect(
      resolveCellLink("https://e.example.com/${env}/${run_id}", context, (s) =>
        s.replace("${env}", "prod"),
      ),
    ).toBe("https://e.example.com/prod/r%202");
    expect(resolveCellLink(undefined, context)).toBeUndefined();
    expect(resolveCellLink("  ", context)).toBeUndefined();
    expect(resolveCellLink("javascript:${row}", context)).toBeUndefined();
  });
});
