import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./sparkline";
import { shopListHref } from "./shops/list-href";

describe("sparklinePoints", () => {
  it("leer → leerer String", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });
  it("ein Wert → waagrechte Linie", () => {
    expect(sparklinePoints([5], 10, 10, 0)).toBe("0,0 10,0");
  });
  it("skaliert von 0 bis Maximum", () => {
    expect(sparklinePoints([0, 5, 10], 20, 10, 0)).toBe("0,10 10,5 20,0");
  });
  it("nur Nullen bleiben am Boden", () => {
    expect(sparklinePoints([0, 0], 10, 10, 0)).toBe("0,10 10,10");
  });
});

describe("shopListHref", () => {
  const f = { text: "", signal: "", sort: "" } as const;
  it("ohne Filter: nackte URL", () => {
    expect(shopListHref(f)).toBe("/shop-spy");
  });
  it("übernimmt Änderungen", () => {
    expect(shopListHref({ ...f, text: "abc" }, { signal: "skaliert" })).toBe("/shop-spy?filter=abc&signal=skaliert");
  });
});
