import { describe, expect, it } from "vitest";
import {
  aggregateAdvertiserStats,
  domainUrl,
  homeHref,
  lastDays,
  parseHomeParams,
  renderAdUrl,
  runningDays,
  weekdayShort,
  zurichDayRange,
} from "./feed";

describe("lastDays", () => {
  it("liefert n Tage bis heute, älteste zuerst, auch über Monatsgrenzen", () => {
    expect(lastDays("2026-12-02", 4)).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});

describe("parseHomeParams", () => {
  const today = "2026-11-26";
  it("Standard: heute und Anzeigen", () => {
    const p = parseHomeParams({}, today);
    expect(p.day).toBe(today);
    expect(p.tab).toBe("anzeigen");
    expect(p.days).toHaveLength(10);
  });
  it("übernimmt gültigen Tag und Tab", () => {
    expect(parseHomeParams({ tag: "2026-11-20", ansicht: "shops" }, today)).toMatchObject({ day: "2026-11-20", tab: "shops" });
  });
  it("verwirft Tage ausserhalb der Auswahl und unbekannte Tabs", () => {
    expect(parseHomeParams({ tag: "2026-10-01", ansicht: "x" }, today)).toMatchObject({ day: today, tab: "anzeigen" });
    expect(parseHomeParams({ tag: "2026-11-27" }, today).day).toBe(today);
  });
});

describe("homeHref", () => {
  it("lässt Standardwerte weg", () => {
    expect(homeHref("2026-11-26", "anzeigen", "2026-11-26")).toBe("/");
    expect(homeHref("2026-11-25", "produkte", "2026-11-26")).toBe("/?tag=2026-11-25&ansicht=produkte");
  });
});

describe("weekdayShort", () => {
  it("gibt den deutschen Wochentag ohne Punkt", () => {
    expect(weekdayShort("2026-11-26")).toBe("Do");
  });
});

describe("runningDays", () => {
  const now = new Date("2026-11-26T10:00:00Z");
  it("zählt bis jetzt, mindestens 1 Tag", () => {
    expect(runningDays("2026-11-26T08:00:00Z", null, now)).toBe(1);
    expect(runningDays("2026-11-21T08:00:00Z", null, now)).toBe(6);
  });
  it("zählt bis zum Enddatum", () => {
    expect(runningDays("2026-11-01T00:00:00Z", "2026-11-10T00:00:00Z", now)).toBe(10);
  });
  it("ohne oder mit ungültigem Start: null", () => {
    expect(runningDays(null, null, now)).toBeNull();
    expect(runningDays("kaputt", null, now)).toBeNull();
  });
});

describe("aggregateAdvertiserStats", () => {
  it("zählt bekannte und laufende Anzeigen pro Werbetreibendem", () => {
    const m = aggregateAdvertiserStats([
      { advertiser_id: "a", stopped_at: null },
      { advertiser_id: "a", stopped_at: "2026-11-01" },
      { advertiser_id: "b", stopped_at: null },
      { advertiser_id: null, stopped_at: null },
    ]);
    expect(m.get("a")).toEqual({ active: 1, total: 2 });
    expect(m.get("b")).toEqual({ active: 1, total: 1 });
    expect(m.size).toBe(2);
  });
});

describe("domainUrl", () => {
  it("baut nur für gültige Domains einen Link", () => {
    expect(domainUrl("Shop.Example.com")).toBe("https://shop.example.com");
    expect(domainUrl("javascript:alert(1)")).toBeNull();
    expect(domainUrl(null)).toBeNull();
  });
});

describe("renderAdUrl", () => {
  it("baut die offizielle Vorschau-URL mit kodierten Werten", () => {
    expect(renderAdUrl("123", "a&b")).toBe("https://www.facebook.com/ads/archive/render_ad/?id=123&access_token=a%26b");
  });
});

describe("zurichDayRange", () => {
  it("Winterzeit: UTC+1", () => {
    expect(zurichDayRange("2026-11-26")).toEqual({ from: "2026-11-25T23:00:00.000Z", to: "2026-11-26T23:00:00.000Z" });
  });
  it("Sommerzeit: UTC+2", () => {
    expect(zurichDayRange("2026-07-01").from).toBe("2026-06-30T22:00:00.000Z");
  });
});
