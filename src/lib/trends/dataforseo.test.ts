import { describe, expect, it } from "vitest";
import {
  buildExploreTask,
  DataForSeoError,
  parseExploreResponse,
  parseKeywordInput,
  toPgArrayLiteral,
  trendDirection,
  validateKeywords,
} from "./dataforseo";

// Testdaten im Format der DataForSEO-Doku. Nur für Tests, erscheinen nie in der Oberfläche.
const okResponse = {
  status_code: 20000,
  status_message: "Ok.",
  cost: 0.009,
  tasks: [
    {
      status_code: 20000,
      status_message: "Ok.",
      cost: 0.009,
      result: [
        {
          keywords: ["a", "b"],
          check_url: "https://trends.google.com/trends/explore?q=a,b",
          datetime: "2026-11-26 10:00:00 +00:00",
          items: [
            {
              type: "google_trends_graph",
              keywords: ["a", "b"],
              data: [
                { date_from: "2026-01-01", date_to: "2026-01-07", values: [10, 50], missing_data: false },
                { date_from: "2026-01-08", date_to: "2026-01-14", values: [0, 100], missing_data: false },
                { date_from: "2026-01-15", date_to: "2026-01-21", values: [3, 4], missing_data: true },
              ],
              averages: [5, 75],
            },
          ],
        },
      ],
    },
  ],
};

describe("parseKeywordInput", () => {
  it("trennt, bereinigt und entfernt Doppelte", () => {
    expect(parseKeywordInput(" Red  Light Mask, led maske;red light mask\n")).toEqual(["red light mask", "led maske"]);
  });
});

describe("validateKeywords", () => {
  it("prüft Anzahl, Länge und verbotene Zeichen", () => {
    expect(validateKeywords([])).toMatch(/mindestens/);
    expect(validateKeywords(["aa", "bb", "cc", "dd", "ee", "ff"])).toMatch(/Höchstens 5/);
    expect(validateKeywords(["a"])).toMatch(/zu kurz/);
    expect(validateKeywords(["anti-aging"])).toMatch(/Sonderzeichen/);
    expect(validateKeywords(["led maske", "creatine gummies"])).toBeNull();
  });
});

describe("buildExploreTask", () => {
  it("setzt den Standort nur, wenn eine Region gewählt ist", () => {
    expect(buildExploreTask({ keywords: ["a b"], geo: "2756", timeRange: "past_12_months" })).toEqual([
      { keywords: ["a b"], location_code: 2756, type: "web", time_range: "past_12_months", item_types: ["google_trends_graph"] },
    ]);
    expect(buildExploreTask({ keywords: ["a b"], geo: "", timeRange: "past_5_years" })[0]).not.toHaveProperty("location_code");
  });
});

describe("toPgArrayLiteral", () => {
  it("setzt Begriffe in Anführungszeichen", () => {
    expect(toPgArrayLiteral(["red light mask", "x,y"])).toBe('{"red light mask","x,y"}');
  });
});

describe("parseExploreResponse", () => {
  it("liest Kurve, Durchschnitte, Link und Kosten", () => {
    const r = parseExploreResponse(okResponse, ["a", "b"]);
    expect(r.keywords).toEqual(["a", "b"]);
    expect(r.points).toHaveLength(3);
    expect(r.points[0]).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-01-07", values: [10, 50] });
    expect(r.averages).toEqual([5, 75]);
    expect(r.checkUrl).toContain("trends.google.com");
    expect(r.costUsd).toBe(0.009);
  });

  it("macht fehlende Daten zu null statt zu 0", () => {
    expect(parseExploreResponse(okResponse, ["a", "b"]).points[2].values).toEqual([null, null]);
  });

  it("akzeptiert einen einzelnen Wert statt eines Arrays", () => {
    const single = structuredClone(okResponse);
    const item = single.tasks[0].result[0].items[0] as unknown as { keywords: string[]; data: { values: unknown }[] };
    item.keywords = ["a"];
    item.data[0].values = 42;
    expect(parseExploreResponse(single, ["a"]).points[0].values).toEqual([42]);
  });

  it("wirft Fehler bei Fehlercodes", () => {
    expect(() => parseExploreResponse({ status_code: 40100, status_message: "Not authorized" }, ["a"])).toThrow(DataForSeoError);
    const failed = { ...okResponse, tasks: [{ status_code: 40501, status_message: "Invalid Field" }] };
    expect(() => parseExploreResponse(failed, ["a"])).toThrow("Invalid Field");
    expect(() => parseExploreResponse(null, ["a"])).toThrow(DataForSeoError);
  });

  it("liefert leere Kurve, wenn kein Diagramm geliefert wurde", () => {
    const empty = { status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [] }] }] };
    expect(parseExploreResponse(empty, ["a"]).points).toEqual([]);
  });
});

describe("trendDirection", () => {
  const pts = (vals: (number | null)[]) => vals.map((v, i) => ({ dateFrom: `d${i}`, dateTo: `d${i}`, values: [v] }));
  it("vergleicht Anfang und Ende", () => {
    expect(trendDirection(pts([10, 10, 20, 30, 80, 90, 90, 100]), 0)).toEqual({ first: 10, last: 95 });
  });
  it("braucht genug Messpunkte", () => {
    expect(trendDirection(pts([1, 2, null, 3]), 0)).toBeNull();
  });
});
