import { describe, expect, it } from "vitest";
import { isStaleTopic, pickNewAdTerms, topicReason } from "./plan";

const c = (normalized: string, n: number, kind: "product" | "niche" = "product") => ({ normalized, kind, productIds: Array.from({ length: n }, (_, i) => String(i)) });

describe("pickNewAdTerms", () => {
  it("nimmt nur Produkt-Themen ohne Stichwort, häufigste zuerst, und hält die Grenzen ein", () => {
    const res = pickNewAdTerms([c("neck fan", 3), c("fans", 9, "niche"), c("dog bed", 5), c("led mask", 4)], { alreadyTermed: new Set(["led mask"]), activeAuto: 0, perDay: 6 });
    expect(res).toEqual(["dog bed", "neck fan"]);
    expect(pickNewAdTerms([c("a b", 3), c("c d", 4)], { alreadyTermed: new Set(), activeAuto: 19, max: 20 })).toEqual(["c d"]);
    expect(pickNewAdTerms([c("a b", 3)], { alreadyTermed: new Set(), activeAuto: 25, max: 20 })).toEqual([]);
  });
});

describe("isStaleTopic", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  it("pausiert nur automatische Themen nach 21 Tagen", () => {
    expect(isStaleTopic({ origin: "auto", last_seen_at: "2026-11-01T00:00:00Z" }, now)).toBe(true);
    expect(isStaleTopic({ origin: "auto", last_seen_at: "2026-11-20T00:00:00Z" }, now)).toBe(false);
    expect(isStaleTopic({ origin: "manual", last_seen_at: "2025-01-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("topicReason", () => {
  it("nennt Zahl der Produkte und Übernahmen", () => {
    expect(topicReason({ kind: "product", productIds: ["1", "2", "3"], listedSum: 1200 }, "2026-11-27")).toContain("3 Produkten");
    expect(topicReason({ kind: "niche", productIds: ["1"], listedSum: 0 }, "2026-11-27")).not.toContain("übernommen");
  });
});
