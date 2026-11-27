import { describe, expect, it } from "vitest";
import { DataForSeoError, type TrendPoint } from "./dataforseo";
import { buildInsightsTask, parseInsightsResponse, seriesOf, toNumberish, trendVerdict } from "./insights";

// Testdaten nach den Feldnamen der DataForSEO-Doku. Nur für Tests, erscheinen nie in der Oberfläche.
const response = (items: unknown[]) => ({
  status_code: 20000,
  tasks: [{ status_code: 20000, cost: 0.011, result: [{ items }] }],
});

const pts = (vals: (number | null)[]): TrendPoint[] =>
  vals.map((v, i) => ({ dateFrom: `2026-01-${String(i + 1).padStart(2, "0")}`, dateTo: "", values: [v] }));

describe("buildInsightsTask", () => {
  it("fragt nur den ersten Begriff mit Regionen, Suchanfragen und Themen ab", () => {
    const [task] = buildInsightsTask({ keywords: ["led maske", "x"], geo: "2756", timeRange: "past_12_months" });
    expect(task.keywords).toEqual(["led maske"]);
    expect(task.location_code).toBe(2756);
    expect(task.item_types).toEqual(["google_trends_map", "google_trends_queries_list", "google_trends_topics_list"]);
  });
  it("lässt den Ort bei weltweit weg", () => {
    const [task] = buildInsightsTask({ keywords: ["a b"], geo: "", timeRange: "past_30_days" });
    expect("location_code" in task).toBe(false);
  });
});

describe("toNumberish", () => {
  it("liest Zahlen und Zahlen als Text", () => {
    expect(toNumberish(42)).toBe(42);
    expect(toNumberish("350")).toBe(350);
    expect(toNumberish("+1,200%")).toBe(1200);
    expect(toNumberish("Breakout")).toBeNull();
    expect(toNumberish(undefined)).toBeNull();
  });
});

describe("parseInsightsResponse", () => {
  it("liest Regionen, Suchanfragen und Themen", () => {
    const r = parseInsightsResponse(
      response([
        {
          type: "google_trends_map",
          data: [
            { geo_id: "CH-ZH", geo_name: "Zürich", values: [80] },
            { geo_id: "CH-BE", geo_name: "Bern", values: [100] },
            { geo_id: "CH-UR", geo_name: "Uri", values: [0] },
          ],
        },
        { type: "google_trends_queries_list", data: { top: [{ query: "led maske test", value: "100" }], rising: [{ query: "led maske kaufen", value: 250 }, { query: "", value: 1 }] } },
        { type: "google_trends_topics_list", data: { top: [], rising: [{ topic_title: "Lichttherapie", topic_type: "Therapie", value: "Breakout" }] } },
      ]),
      "led maske",
    );
    expect(r.regions.map((x) => x.name)).toEqual(["Bern", "Zürich"]);
    expect(r.topQueries).toEqual([{ label: "led maske test", value: 100 }]);
    expect(r.risingQueries).toEqual([{ label: "led maske kaufen", value: 250 }]);
    expect(r.risingTopics).toEqual([{ label: "Lichttherapie", value: null, kind: "Therapie" }]);
    expect(r.costUsd).toBe(0.011);
  });
  it("gibt leere Listen, wenn Google nichts liefert", () => {
    const r = parseInsightsResponse(response([]), "x y");
    expect(r.regions).toEqual([]);
    expect(r.risingQueries).toEqual([]);
  });
  it("wirft bei Fehlern statt zu raten", () => {
    expect(() => parseInsightsResponse({ status_code: 40100, status_message: "nope" }, "x")).toThrow(DataForSeoError);
    expect(() => parseInsightsResponse({ status_code: 20000, tasks: [{ status_code: 40501 }] }, "x")).toThrow(DataForSeoError);
  });
});

describe("trendVerdict", () => {
  it("erkennt starken Anstieg", () => {
    const v = trendVerdict(pts([10, 10, 20, 30, 40, 50, 60, 80]), 0)!;
    expect(v.key).toBe("strong_up");
    expect(v.label).toBe("steigt stark");
    expect(v.tone).toBe("positive");
    expect(v.current).toBe(80);
    expect(v.peakDate).toBe("2026-01-08");
  });
  it("erkennt leichten Anstieg, stabil und Rückgang", () => {
    expect(trendVerdict(pts([50, 50, 50, 55, 55, 60, 60, 60]), 0)!.key).toBe("up");
    expect(trendVerdict(pts([50, 52, 48, 50, 51, 49, 50, 52]), 0)!.key).toBe("flat");
    expect(trendVerdict(pts([60, 60, 55, 50, 45, 45, 40, 40]), 0)!.key).toBe("down");
    expect(trendVerdict(pts([100, 90, 70, 50, 30, 20, 10, 10]), 0)!.key).toBe("strong_down");
  });
  it("Start bei 0: steigt stark nur bei spürbarem Ende", () => {
    const v = trendVerdict(pts([0, 0, 5, 10, 20, 30, 40, 50]), 0)!;
    expect(v.key).toBe("strong_up");
    expect(v.changePct).toBeNull();
    expect(trendVerdict(pts([0, 0, 0, 1, 0, 2, 0, 3]), 0)!.key).toBe("flat");
  });
  it("braucht mindestens 6 Messpunkte und ignoriert Lücken", () => {
    expect(trendVerdict(pts([1, 2, 3, null, null]), 0)).toBeNull();
    expect(seriesOf(pts([1, null, 3]), 0)).toEqual([1, 0, 3]);
  });
});
