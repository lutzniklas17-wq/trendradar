import { describe, expect, it } from "vitest";
import {
  filterTopics,
  parseRadarFilters,
  filterStartups,
  parseStartupFilters,
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

describe("Startup-Filter", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const base = { description: null, website_url: null, source_id: "meta_new_advertisers", first_discovered_at: "2026-11-20T00:00:00Z" };
  const items = [
    { ...base, name: "Neu", stage: "small_business", launched_at: "2026-11-15T00:00:00Z", relevance: "ecommerce" },
    { ...base, name: "Alt", stage: "startup", launched_at: "2026-03-01T00:00:00Z", relevance: "unclear", source_id: "product_hunt" },
    { ...base, name: "Ohne Datum", stage: null, launched_at: null, relevance: "unclear", source_id: "rss" },
    { ...base, name: "Öl", stage: null, launched_at: "2026-11-20T00:00:00Z", relevance: "excluded" },
  ];

  it("liest nur bekannte Werte aus der URL", () => {
    expect(parseStartupFilters({ art: "small_business", gestartet: "30", relevanz: "x", quelle: "rss", sortierung: "start" })).toMatchObject({
      stage: "small_business",
      launchedDays: 30,
      relevance: "",
      source: "rss",
      sort: "start",
    });
    expect(parseStartupFilters({ gestartet: "45" }).launchedDays).toBeNull();
  });

  it("blendet ausgeschlossene Branchen immer aus", () => {
    expect(filterStartups(items, parseStartupFilters({}), now).map((i) => i.name)).not.toContain("Öl");
  });

  it("filtert nach Start-Datum, Art und Relevanz", () => {
    expect(filterStartups(items, parseStartupFilters({ gestartet: "30" }), now).map((i) => i.name)).toEqual(["Neu"]);
    expect(filterStartups(items, parseStartupFilters({ art: "startup" }), now).map((i) => i.name)).toEqual(["Alt"]);
    expect(filterStartups(items, parseStartupFilters({ relevanz: "ecommerce" }), now).map((i) => i.name)).toEqual(["Neu"]);
    expect(filterStartups(items, parseStartupFilters({ sortierung: "start" }), now)[0].name).toBe("Neu");
  });
});

describe("Radar-Filter", () => {
  const topics = [
    { term: "Pilzkaffee", note: null, outlook: "rising", current: 8, previous: 2 },
    { term: "Rotlicht", note: "Maske", outlook: "stable", current: 10, previous: 9 },
    { term: "Yoga", note: null, outlook: "too_little", current: 1, previous: 0 },
  ];

  it("filtert nach Einschätzung und Text", () => {
    expect(filterTopics(topics, parseRadarFilters({ einschaetzung: "rising" })).map((t) => t.term)).toEqual(["Pilzkaffee"]);
    expect(filterTopics(topics, parseRadarFilters({ thema: "maske" })).map((t) => t.term)).toEqual(["Rotlicht"]);
    expect(parseRadarFilters({ einschaetzung: "egal" }).outlook).toBe("");
  });

  it("sortiert nach Treffern oder Zunahme", () => {
    expect(filterTopics(topics, parseRadarFilters({})).map((t) => t.term)).toEqual(["Rotlicht", "Pilzkaffee", "Yoga"]);
    expect(filterTopics(topics, parseRadarFilters({ reihenfolge: "change" }))[0].term).toBe("Pilzkaffee");
  });
});

describe("Produkt-Bibliothek", () => {
  it("liest nur bekannte Werte aus der URL", async () => {
    const { parseLibraryFilters, hasLibraryFilters } = await import("./list-filters");
    const f = parseLibraryFilters({ filter: " fan ", begriff: "Neck Fan", preis: "10", relevanz: "empfohlen", sortierung: "x", gratisversand: "1", seite: "3" });
    expect(f).toMatchObject({ text: "fan", term: "neck fan", maxPrice: 10, relevance: "empfohlen", sort: "", freeShipping: true, showHidden: false, page: 3 });
    expect(hasLibraryFilters(f)).toBe(true);
    const empty = parseLibraryFilters({ preis: "7", seite: "-1", relevanz: "boese" });
    expect(empty).toMatchObject({ maxPrice: null, page: 1, relevance: "" });
    expect(hasLibraryFilters(empty)).toBe(false);
  });
  it("baut sichere Suchmuster und Blätter-Links", async () => {
    const { likePattern, libraryQuery, parseLibraryFilters } = await import("./list-filters");
    expect(likePattern("neck, fan%")).toBe("%neck%fan%");
    expect(likePattern("  ")).toBeNull();
    expect(libraryQuery(parseLibraryFilters({ begriff: "fan", preis: "5" }), 2)).toBe("begriff=fan&preis=5&seite=2");
  });
});
