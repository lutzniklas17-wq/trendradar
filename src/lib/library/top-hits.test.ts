import { describe, expect, it } from "vitest";
import { listedGrowth, scoreProduct, topHits, type HitInput } from "./top-hits";

const now = new Date("2026-11-26T12:00:00Z");
const base: HitInput = {
  id: "a",
  listedCount: 150,
  listedAt: null,
  relevance: "relevant",
  hidden: false,
  imageUrl: "https://x/a.jpg",
  searchTerms: [],
  aiRelevant: null,
  aiScore: null,
  aiReason: null,
  snapshots: [],
};

describe("listedGrowth", () => {
  it("braucht zwei Messungen mit 5–10 Tagen Abstand", () => {
    expect(listedGrowth([{ day: "2026-11-26", listedCount: 10 }])).toBeNull();
    expect(listedGrowth([{ day: "2026-11-26", listedCount: 10 }, { day: "2026-11-24", listedCount: 5 }])).toBeNull();
    expect(listedGrowth([{ day: "2026-11-26", listedCount: 60 }, { day: "2026-11-19", listedCount: 20 }])).toEqual({ delta: 40, days: 7 });
  });
});

describe("scoreProduct", () => {
  const ads = new Map([["neck fan", 42]]);
  it("trennt Fakt, Signal und Einschätzung", () => {
    const hit = scoreProduct(
      { ...base, searchTerms: ["neck fan"], aiScore: 4, aiReason: "Sommerprodukt", listedAt: "2026-11-10T00:00:00Z", snapshots: [{ day: "2026-11-26", listedCount: 150 }, { day: "2026-11-19", listedCount: 100 }] },
      ads,
      now,
    )!;
    expect(hit.claims.map((c) => c.kind)).toEqual(["fact", "signal", "signal", "signal", "assessment"]);
    expect(hit.claims[1].text).toBe("+50 Übernahmen in 7 Tagen");
    expect(hit.claims[3].text).toContain("42 bekannte Meta-Anzeigen");
  });
  it("lässt Ausgeschlossene, Ausgeblendete, Produkte ohne Bild und ohne Signal weg", () => {
    expect(scoreProduct({ ...base, relevance: "irrelevant" }, ads, now)).toBeNull();
    expect(scoreProduct({ ...base, hidden: true }, ads, now)).toBeNull();
    expect(scoreProduct({ ...base, aiRelevant: false }, ads, now)).toBeNull();
    expect(scoreProduct({ ...base, imageUrl: null }, ads, now)).toBeNull();
    expect(scoreProduct({ ...base, listedCount: 20 }, ads, now)).toBeNull();
  });
});

describe("topHits", () => {
  it("sortiert nach Punkten und begrenzt die Anzahl", () => {
    const list = [
      { ...base, id: "klein", listedCount: 120 },
      { ...base, id: "gross", listedCount: 5000 },
      { ...base, id: "nichts", listedCount: 3 },
    ];
    expect(topHits(list, new Map(), 5, now).map((h) => h.id)).toEqual(["gross", "klein"]);
    expect(topHits(list, new Map(), 1, now)).toHaveLength(1);
  });
});
