import { describe, expect, it } from "vitest";
import { adSignals, summarizeAds } from "./verdict";

const now = new Date("2026-11-27T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - (d - 1) * 86_400_000).toISOString();

describe("adSignals", () => {
  it("beendete Anzeigen bekommen keine Einschätzung", () => {
    expect(adSignals({ started_at: daysAgo(200), stopped_at: daysAgo(10), stats: { active: 50, total: 60 } }, now)).toEqual([]);
  });
  it("unterscheidet neu, bewährt und Dauerläufer", () => {
    expect(adSignals({ started_at: daysAgo(3), stopped_at: null, stats: null }, now).map((s) => s.key)).toEqual(["new"]);
    expect(adSignals({ started_at: daysAgo(15), stopped_at: null, stats: null }, now)).toEqual([]);
    expect(adSignals({ started_at: daysAgo(30), stopped_at: null, stats: null }, now).map((s) => s.key)).toEqual(["proven"]);
    expect(adSignals({ started_at: daysAgo(120), stopped_at: null, stats: null }, now).map((s) => s.label)).toEqual(["Dauerläufer"]);
  });
  it("erkennt einen skalierenden Shop ab 10 laufenden Anzeigen", () => {
    expect(adSignals({ started_at: null, stopped_at: null, stats: { active: 9, total: 20 } }, now)).toEqual([]);
    expect(adSignals({ started_at: daysAgo(40), stopped_at: null, stats: { active: 12, total: 20 } }, now).map((s) => s.key)).toEqual(["proven", "scaling"]);
  });
});

describe("summarizeAds", () => {
  it("zählt aktive, bewährte, Werbetreibende, längste Laufzeit und Reichweite", () => {
    const s = summarizeAds(
      [
        { started_at: daysAgo(40), stopped_at: null, eu_reach: 1000, advertiser_name: "A", page_id: "1" },
        { started_at: daysAgo(5), stopped_at: null, eu_reach: null, advertiser_name: "A", page_id: "1" },
        { started_at: daysAgo(100), stopped_at: daysAgo(20), eu_reach: 500, advertiser_name: "B", page_id: null },
      ],
      now,
    );
    expect(s).toEqual({ total: 3, active: 2, proven: 1, advertisers: 2, longestDays: 81, reach: 1500 });
  });
  it("ohne Reichweite bleibt sie leer statt 0", () => {
    expect(summarizeAds([], now)).toEqual({ total: 0, active: 0, proven: 0, advertisers: 0, longestDays: null, reach: null });
  });
});
