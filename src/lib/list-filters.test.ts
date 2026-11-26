import { describe, expect, it } from "vitest";
import {
  categoryOptions,
  filterItems,
  filterShops,
  hasItemFilters,
  matchesText,
  parseItemFilters,
  parseShopFilters,
  resultLabel,
  type FilterableShop,
} from "./list-filters";

describe("matchesText", () => {
  it("findet alle Wörter unabhängig von Gross-/Kleinschreibung und Akzenten", () => {
    expect(matchesText(["LED Gesichtsmaske", "Beauty"], "maske beauty")).toBe(true);
    expect(matchesText(["Crème Pflege"], "creme")).toBe(true);
    expect(matchesText(["LED Maske"], "maske kabel")).toBe(false);
    expect(matchesText([null, undefined], "")).toBe(true);
  });
});

describe("parseItemFilters", () => {
  it("übernimmt nur gültige Werte", () => {
    const f = parseItemFilters({ zeitraum: "30", sortierung: "name", neu: "1", bereich: "ad_spy", kategorie: "Beauty" });
    expect(f).toEqual({ text: "", category: "Beauty", periodDays: 30, onlyNew: true, area: "ad_spy", sort: "name" });
    const bad = parseItemFilters({ zeitraum: "5", sortierung: "x", bereich: "hack", neu: "ja" });
    expect(bad).toMatchObject({ periodDays: null, sort: "", area: "", onlyNew: false });
    expect(hasItemFilters(bad)).toBe(false);
  });
});

describe("filterItems", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const items = [
    { name: "Red Light Mask", category: "Beauty", area: "trend_spy", is_new: true, date: "2026-11-25T00:00:00Z" },
    { name: "Creatine Gummies", category: "Fitness", area: "trend_spy", is_new: false, date: "2026-10-01T00:00:00Z" },
    { name: "Ab Roller", category: null, area: "ad_spy", is_new: false, date: null },
  ];
  const base = parseItemFilters({});

  it("sortiert standardmässig nach neuestem Datum, ohne Datum ans Ende", () => {
    expect(filterItems(items, base, now).map((i) => i.name)).toEqual(["Red Light Mask", "Creatine Gummies", "Ab Roller"]);
  });
  it("filtert nach Zeitraum, Kategorie, Bereich und neu", () => {
    expect(filterItems(items, { ...base, periodDays: 7 }, now).map((i) => i.name)).toEqual(["Red Light Mask"]);
    expect(filterItems(items, { ...base, category: "Fitness" }, now)).toHaveLength(1);
    expect(filterItems(items, { ...base, area: "ad_spy" }, now)[0].name).toBe("Ab Roller");
    expect(filterItems(items, { ...base, onlyNew: true }, now)).toHaveLength(1);
  });
  it("sortiert nach Name", () => {
    expect(filterItems(items, { ...base, sort: "name" }, now)[0].name).toBe("Ab Roller");
  });
  it("liefert Kategorien eindeutig und sortiert", () => {
    expect(categoryOptions([...items, { category: " Beauty " }]).map((o) => o.value)).toEqual(["", "Beauty", "Fitness"]);
  });
});

describe("filterShops", () => {
  const shop = (s: Partial<FilterableShop> & { name: string }): FilterableShop => ({
    domain: null,
    activeAds: null,
    delta: null,
    newAds: null,
    scaling: false,
    dropping: false,
    hasError: false,
    ...s,
  });
  const shops = [
    shop({ name: "Alpha", domain: "alpha.ch", activeAds: 10, delta: 2, newAds: 1 }),
    shop({ name: "Beta", activeAds: 40, delta: 25, newAds: 9, scaling: true }),
    shop({ name: "Gamma", hasError: true }),
  ];

  it("sortiert nach meisten Anzeigen, ungezählte zuletzt", () => {
    expect(filterShops(shops, parseShopFilters({})).map((s) => s.name)).toEqual(["Beta", "Alpha", "Gamma"]);
  });
  it("filtert nach Signal und Text (auch Domain)", () => {
    expect(filterShops(shops, parseShopFilters({ signal: "skaliert" })).map((s) => s.name)).toEqual(["Beta"]);
    expect(filterShops(shops, parseShopFilters({ signal: "ungezaehlt" })).map((s) => s.name)).toEqual(["Gamma"]);
    expect(filterShops(shops, parseShopFilters({ filter: "alpha.ch" })).map((s) => s.name)).toEqual(["Alpha"]);
  });
  it("ignoriert unbekannte Werte", () => {
    expect(parseShopFilters({ signal: "x", sortierung: "y" })).toEqual({ text: "", signal: "", sort: "" });
  });
});

describe("resultLabel", () => {
  it("zeigt Anzahl und Gesamtzahl", () => {
    expect(resultLabel(3, 3)).toBe("3 Einträge");
    expect(resultLabel(1, 4, ["Shop", "Shops"])).toBe("1 von 4 Shops");
  });
});
