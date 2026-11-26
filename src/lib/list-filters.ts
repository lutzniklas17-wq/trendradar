/**
 * Filter und Sortierung für Listen-Seiten (Trend Spy, Watchlist, Suche, Shop Spy).
 * Alle Werte kommen aus der URL und werden hier geprüft; Unbekanntes wird ignoriert.
 */

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined);

/** Text für Vergleiche: klein, ohne Akzente, ohne doppelte Leerzeichen. */
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesText(haystack: (string | null | undefined)[], needle: string) {
  const n = normalizeText(needle);
  if (!n) return true;
  const h = normalizeText(haystack.filter(Boolean).join(" "));
  return n.split(" ").every((word) => h.includes(word));
}

// ---------- Produkte und Einträge ----------

export const ITEM_PERIODS = [
  { value: "", label: "Alle Zeiträume" },
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "90", label: "Letzte 90 Tage" },
] as const;

export const ITEM_SORTS = [
  { value: "", label: "Neueste zuerst" },
  { value: "alt", label: "Älteste zuerst" },
  { value: "name", label: "Name A–Z" },
] as const;

export const AREA_OPTIONS = [
  { value: "", label: "Alle Bereiche" },
  { value: "trend_spy", label: "Trend Spy" },
  { value: "ad_spy", label: "Ad Spy" },
  { value: "startup_spy", label: "Startup Spy" },
  { value: "future_radar", label: "Future Radar" },
] as const;

export type ItemFilters = {
  text: string;
  category: string;
  periodDays: number | null;
  onlyNew: boolean;
  area: string;
  sort: "" | "alt" | "name";
};

export function parseItemFilters(params: Params): ItemFilters {
  const period = Number(one(params.zeitraum));
  const sort = one(params.sortierung);
  const area = one(params.bereich) ?? "";
  return {
    text: (one(params.filter) ?? "").slice(0, 100),
    category: (one(params.kategorie) ?? "").slice(0, 100),
    periodDays: ITEM_PERIODS.some((p) => p.value !== "" && Number(p.value) === period) ? period : null,
    onlyNew: one(params.neu) === "1",
    area: AREA_OPTIONS.some((a) => a.value === area) ? area : "",
    sort: sort === "alt" || sort === "name" ? sort : "",
  };
}

export function hasItemFilters(f: ItemFilters) {
  return Boolean(f.text || f.category || f.periodDays || f.onlyNew || f.area || f.sort);
}

export type FilterableItem = {
  name: string;
  category: string | null;
  area?: string;
  is_new?: boolean;
  note?: string | null;
  /** Datum für Zeitraum und Sortierung (entdeckt oder gespeichert). */
  date?: string | null;
};

export function filterItems<T extends FilterableItem>(items: T[], f: ItemFilters, now = new Date()): T[] {
  const since = f.periodDays ? now.getTime() - f.periodDays * 86_400_000 : null;
  const out = items.filter(
    (i) =>
      matchesText([i.name, i.category, i.note], f.text) &&
      (!f.category || i.category === f.category) &&
      (!f.area || i.area === f.area) &&
      (!f.onlyNew || i.is_new === true) &&
      (since === null || (i.date != null && new Date(i.date).getTime() >= since)),
  );
  if (f.sort === "name") return out.sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  const time = (i: T) => (i.date ? new Date(i.date).getTime() : 0);
  return f.sort === "alt" ? out.sort((a, b) => time(a) - time(b)) : out.sort((a, b) => time(b) - time(a));
}

/** Kategorien für die Auswahlliste, alphabetisch, ohne leere Werte. */
export function categoryOptions(items: { category: string | null }[], label = "Alle Kategorien") {
  const set = new Set(items.map((i) => i.category?.trim()).filter((c): c is string => Boolean(c)));
  return [{ value: "", label }, ...[...set].sort((a, b) => a.localeCompare(b, "de-CH")).map((c) => ({ value: c, label: c }))];
}

// ---------- Shops ----------

export const SHOP_SIGNALS = [
  { value: "", label: "Alle Shops" },
  { value: "skaliert", label: "Signal: skaliert" },
  { value: "ruecklaeufig", label: "Stark rückläufig" },
  { value: "fehler", label: "Mit Fehler" },
  { value: "ungezaehlt", label: "Noch nicht gezählt" },
] as const;

export const SHOP_SORTS = [
  { value: "", label: "Meiste Anzeigen" },
  { value: "veraenderung", label: "Grösste Zunahme" },
  { value: "neu", label: "Meiste neue Anzeigen" },
  { value: "name", label: "Name A–Z" },
] as const;

export type ShopFilters = {
  text: string;
  signal: (typeof SHOP_SIGNALS)[number]["value"];
  sort: (typeof SHOP_SORTS)[number]["value"];
};

export function parseShopFilters(params: Params): ShopFilters {
  const signal = one(params.signal) ?? "";
  const sort = one(params.sortierung) ?? "";
  return {
    text: (one(params.filter) ?? "").slice(0, 100),
    signal: SHOP_SIGNALS.find((s) => s.value === signal)?.value ?? "",
    sort: SHOP_SORTS.find((s) => s.value === sort)?.value ?? "",
  };
}

export function hasShopFilters(f: ShopFilters) {
  return Boolean(f.text || f.signal || f.sort);
}

export type FilterableShop = {
  name: string;
  domain: string | null;
  activeAds: number | null;
  delta: number | null;
  newAds: number | null;
  scaling: boolean;
  dropping: boolean;
  hasError: boolean;
};

export function filterShops<T extends FilterableShop>(shops: T[], f: ShopFilters): T[] {
  const out = shops.filter((s) => {
    if (!matchesText([s.name, s.domain], f.text)) return false;
    switch (f.signal) {
      case "skaliert":
        return s.scaling;
      case "ruecklaeufig":
        return s.dropping;
      case "fehler":
        return s.hasError;
      case "ungezaehlt":
        return s.activeAds === null;
      default:
        return true;
    }
  });
  // Fehlende Werte immer ans Ende
  const desc = (pick: (s: T) => number | null) => (a: T, b: T) => (pick(b) ?? -Infinity) - (pick(a) ?? -Infinity);
  switch (f.sort) {
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
    case "veraenderung":
      return out.sort(desc((s) => s.delta));
    case "neu":
      return out.sort(desc((s) => s.newAds));
    default:
      return out.sort(desc((s) => s.activeAds));
  }
}

/** „3 von 12“ bzw. „12 Einträge“ für die Filterleiste. */
export function resultLabel(shown: number, total: number, noun: [string, string] = ["Eintrag", "Einträge"]) {
  const word = (n: number) => (n === 1 ? noun[0] : noun[1]);
  return shown === total ? `${total} ${word(total)}` : `${shown} von ${total} ${word(total)}`;
}
