import { describe, expect, it } from "vitest";
import {
  buildSearchUrl,
  groupByAdvertiser,
  libraryUrl,
  MetaAdError,
  normalizeTerms,
  parseSearchResponse,
  runningDays,
  toMetaError,
  validateTerms,
  type AdQuery,
} from "./meta";

const query: AdQuery = { terms: "led maske", country: "DE", status: "ACTIVE", platform: "", searchType: "KEYWORD_UNORDERED" };

describe("Eingaben", () => {
  it("fasst Leerzeichen zusammen und prüft die Länge", () => {
    expect(normalizeTerms("  led   maske ")).toBe("led maske");
    expect(validateTerms("")).toMatch(/Suchbegriff/);
    expect(validateTerms("x".repeat(101))).toMatch(/100/);
    expect(validateTerms("led maske")).toBeNull();
  });
});

describe("buildSearchUrl", () => {
  it("setzt die Parameter laut Doku und kein Token", () => {
    const url = buildSearchUrl(query);
    expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v26.0/ads_archive");
    expect(url.searchParams.get("ad_reached_countries")).toBe('["DE"]');
    expect(url.searchParams.get("ad_type")).toBe("ALL");
    expect(url.searchParams.get("ad_active_status")).toBe("ACTIVE");
    expect(url.searchParams.get("search_terms")).toBe("led maske");
    expect(url.searchParams.get("fields")).toContain("eu_total_reach");
    expect(url.searchParams.has("publisher_platforms")).toBe(false);
    expect(url.searchParams.has("access_token")).toBe(false);
  });

  it("übernimmt Plattform, Cursor und Version", () => {
    const url = buildSearchUrl({ ...query, platform: "INSTAGRAM", after: "abc" }, "v27.0");
    expect(url.pathname).toBe("/v27.0/ads_archive");
    expect(url.searchParams.get("publisher_platforms")).toBe('["INSTAGRAM"]');
    expect(url.searchParams.get("after")).toBe("abc");
  });
});

describe("parseSearchResponse", () => {
  it("liest Anzeigen aus und baut einen Link ohne Token", () => {
    const res = parseSearchResponse({
      data: [
        {
          id: "123",
          page_id: "9",
          page_name: "Glow Shop",
          ad_creative_bodies: ["Strahlende Haut ", ""],
          ad_creative_link_titles: ["LED Maske"],
          ad_delivery_start_time: "2026-10-01",
          publisher_platforms: ["FACEBOOK", "INSTAGRAM"],
          eu_total_reach: 15000,
          ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=123&access_token=GEHEIM",
        },
        { page_name: "ohne id" },
      ],
      paging: { cursors: { after: "c1" }, next: "https://graph.facebook.com/..." },
    });
    expect(res.ads).toHaveLength(1);
    const ad = res.ads[0];
    expect(ad.bodies).toEqual(["Strahlende Haut"]);
    expect(ad.euReach).toBe(15000);
    expect(ad.stoppedAt).toBeNull();
    expect(ad.libraryUrl).toBe(libraryUrl("123"));
    expect(JSON.stringify(ad)).not.toContain("GEHEIM");
    expect(res.nextCursor).toBe("c1");
  });

  it("kein Cursor ohne next", () => {
    expect(parseSearchResponse({ data: [{ id: "1" }], paging: { cursors: { after: "c1" } } }).nextCursor).toBeNull();
  });

  it("wirft bei Fehlerantworten", () => {
    expect(() => parseSearchResponse({ error: { code: 190, message: "x" } })).toThrow(/abgelaufen/);
    expect(() => parseSearchResponse({ foo: 1 })).toThrow(MetaAdError);
  });
});

describe("toMetaError", () => {
  it("übersetzt bekannte Codes", () => {
    expect(toMetaError({ code: 613 }).message).toMatch(/Abfragelimit/);
    expect(toMetaError({ code: 10 }).message).toMatch(/Identitätsbestätigung/);
    expect(toMetaError({ code: 100 }).message).toMatch(/Parameter/);
    expect(toMetaError(null).message).toMatch(/Fehler/);
  });
});

describe("runningDays und groupByAdvertiser", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  it("zählt bis heute oder bis zum Ende", () => {
    expect(runningDays({ startedAt: "2026-10-27T12:00:00Z", stoppedAt: null }, now)).toBe(30);
    expect(runningDays({ startedAt: "2026-11-01T00:00:00Z", stoppedAt: "2026-11-11T00:00:00Z" }, now)).toBe(10);
    expect(runningDays({ startedAt: null, stoppedAt: null }, now)).toBeNull();
    expect(runningDays({ startedAt: "kaputt", stoppedAt: null }, now)).toBeNull();
  });

  it("gruppiert nach Seite und sortiert nach Anzahl", () => {
    const base = { bodies: [], linkTitles: [], linkCaptions: [], linkDescriptions: [], createdAt: null, stoppedAt: null, platforms: [], languages: [], euReach: null, libraryUrl: "" };
    const groups = groupByAdvertiser(
      [
        { ...base, id: "1", pageId: "a", pageName: "A", startedAt: "2026-11-20T12:00:00Z" },
        { ...base, id: "2", pageId: "b", pageName: "B", startedAt: "2026-11-01T12:00:00Z" },
        { ...base, id: "3", pageId: "b", pageName: "B", startedAt: "2026-11-25T12:00:00Z" },
      ],
      now,
    );
    expect(groups[0]).toMatchObject({ pageName: "B", count: 2, longestDays: 25 });
    expect(groups[1]).toMatchObject({ pageName: "A", count: 1, longestDays: 6 });
  });
});
