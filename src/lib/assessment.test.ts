import { describe, expect, it } from "vitest";
import { averageScore, parseClaims, parseScores, parseVerdict } from "./assessment";

describe("parseClaims", () => {
  it("verwirft unbekannte Abschnitte und Arten", () => {
    const claims = parseClaims([
      { section: "problem", kind: "assessment", text: "Hilft gegen Pickel" },
      { section: "unbekannt", kind: "fact", text: "x" },
      { section: "risks", kind: "erfunden", text: "y" },
      { section: "risks", kind: "signal", text: "  " },
      "kein Objekt",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims[0].section).toBe("problem");
  });

  it("stuft einen Fakt ohne Quelle zur Einschätzung herab", () => {
    const [noSource, withSource] = parseClaims([
      { section: "competitors", kind: "fact", text: "Amazon verkauft es für 49 €" },
      { section: "competitors", kind: "fact", text: "Shop X: 39 €", source_url: "https://example.com/p" },
    ]);
    expect(noSource.kind).toBe("assessment");
    expect(withSource.kind).toBe("fact");
    expect(withSource.sourceUrl).toBe("https://example.com/p");
  });

  it("lässt nur http(s)-Links als Quelle zu", () => {
    const [c] = parseClaims([{ section: "risks", kind: "fact", text: "x", source_url: "javascript:alert(1)" }]);
    expect(c.sourceUrl).toBeUndefined();
    expect(c.kind).toBe("assessment");
  });
});

describe("parseScores", () => {
  it("akzeptiert nur ganze Zahlen 1–5, sonst null", () => {
    const s = parseScores({
      trend: { score: 4, reason: "steigt", basis: "data" },
      margin: { score: 7, reason: "zu hoch" },
      risk: { score: 2.5, reason: "halb" },
      fantasie: { score: 5 },
    });
    expect(s.trend).toEqual({ score: 4, reason: "steigt", basis: "data" });
    expect(s.margin?.score).toBeNull();
    expect(s.margin?.basis).toBe("assessment");
    expect(s.risk?.score).toBeNull();
    expect(Object.keys(s)).not.toContain("fantasie");
  });
});

describe("averageScore", () => {
  it("rechnet erst ab der Hälfte bewerteter Kriterien einen Durchschnitt", () => {
    const few = parseScores({ trend: { score: 5 }, margin: { score: 3 } });
    expect(averageScore(few).average).toBeNull();
    const enough = parseScores({
      trend: { score: 5 },
      margin: { score: 3 },
      demand: { score: 4 },
      risk: { score: 2 },
      longevity: { score: null },
    });
    expect(averageScore(enough)).toEqual({ average: 3.5, rated: 4 });
  });
});

describe("parseVerdict", () => {
  it("liest Urteil und Begründung", () => {
    expect(parseVerdict("test: gute Marge, klarer Hook")).toEqual({ verdict: "test", reason: "gute Marge, klarer Hook" });
    expect(parseVerdict("Freitext ohne Urteil")).toEqual({ verdict: null, reason: "Freitext ohne Urteil" });
    expect(parseVerdict(null)).toEqual({ verdict: null, reason: null });
  });
});
