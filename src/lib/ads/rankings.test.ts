import { describe, expect, it } from "vitest";
import { parseRankFilters, rankHref } from "./rankings";

describe("Rangliste-Filter", () => {
  it("Standard: Werbetreibende, meiste aktive Anzeigen, heute und gestern", () => {
    expect(parseRankFilters({})).toEqual({ view: "werbetreibende", sort: "active", days: 2, country: null, platform: null, termId: null });
  });

  it("liest gültige Werte und verwirft ungültige", () => {
    const f = parseRankFilters({ ansicht: "anzeigen", sortierung: "reach", zeitraum: "7", land: "fr", plattform: "INSTAGRAM", stichwort: "nicht-uuid" });
    expect(f).toEqual({ view: "anzeigen", sort: "reach", days: 7, country: "FR", platform: "INSTAGRAM", termId: null });
    expect(parseRankFilters({ sortierung: "reach" }).sort).toBe("active");
    expect(parseRankFilters({ land: "CH", zeitraum: "999" })).toMatchObject({ country: null, days: 2 });
  });

  it("baut Links mit geänderten Filtern", () => {
    const f = parseRankFilters({ land: "DE" });
    expect(rankHref(f, { sort: "new" })).toBe("/ad-spy/rangliste?sortierung=new&land=DE");
    expect(rankHref(f, { view: "anzeigen", sort: "longest", days: 30 })).toBe("/ad-spy/rangliste?ansicht=anzeigen&sortierung=longest&zeitraum=30&land=DE");
  });
});
