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
// ---------- Startup Spy ----------

export const STARTUP_STAGES = [
  { value: "", label: "Alle Arten" },
  { value: "startup", label: "Startup (Launch)" },
  { value: "small_business", label: "Small Business (neuer Shop)" },
] as const;

export const STARTUP_LAUNCH = [
  { value: "", label: "Jederzeit gestartet" },
  { value: "30", label: "Gestartet ≤ 30 Tage" },
  { value: "90", label: "Gestartet ≤ 90 Tage" },
  { value: "180", label: "Gestartet ≤ 180 Tage" },
] as const;

export const STARTUP_RELEVANCE = [
  { value: "", label: "E-Commerce und unklar" },
  { value: "ecommerce", label: "Nur E-Commerce" },
] as const;

export const STARTUP_SOURCES = [
  { value: "", label: "Alle Quellen" },
  { value: "meta_new_advertisers", label: "Neue Werbetreibende" },
  { value: "product_hunt", label: "Product Hunt" },
  { value: "rss", label: "RSS-Feeds" },
] as const;

export const STARTUP_SORTS = [
  { value: "", label: "Zuletzt entdeckt" },
  { value: "start", label: "Zuletzt gestartet" },
  { value: "name", label: "Name A–Z" },
] as const;

type Value<T extends readonly { value: string }[]> = T[number]["value"];
const pick = <T extends readonly { value: string }[]>(list: T, raw: string | undefined): Value<T> =>
  (list.find((o) => o.value === raw)?.value ?? "") as Value<T>;

export type StartupFilters = {
  text: string;
  stage: Value<typeof STARTUP_STAGES>;
  launchedDays: number | null;
  relevance: Value<typeof STARTUP_RELEVANCE>;
  source: Value<typeof STARTUP_SOURCES>;
  sort: Value<typeof STARTUP_SORTS>;
};

export function parseStartupFilters(params: Params): StartupFilters {
  const launch = pick(STARTUP_LAUNCH, one(params.gestartet));
  return {
    text: (one(params.filter) ?? "").slice(0, 100),
    stage: pick(STARTUP_STAGES, one(params.art)),
    launchedDays: launch ? Number(launch) : null,
    relevance: pick(STARTUP_RELEVANCE, one(params.relevanz)),
    source: pick(STARTUP_SOURCES, one(params.quelle)),
    sort: pick(STARTUP_SORTS, one(params.sortierung)),
  };
}

export function hasStartupFilters(f: StartupFilters) {
  return Boolean(f.text || f.stage || f.launchedDays || f.relevance || f.source || f.sort);
}

export type FilterableStartup = {
  name: string;
  description: string | null;
  website_url: string | null;
  stage: string | null;
  launched_at: string | null;
  relevance: string | null;
  source_id: string | null;
  first_discovered_at: string;
};

/**
 * Filtert Startup-Spy-Einträge. Ausgeschlossene Branchen sind nie sichtbar.
 * „Gestartet ≤ N Tage“ braucht ein Start-Datum aus der Quelle; Einträge ohne Datum fallen dann weg.
 */
export function filterStartups<T extends FilterableStartup>(items: T[], f: StartupFilters, now = new Date()): T[] {
  const since = f.launchedDays ? now.getTime() - f.launchedDays * 86_400_000 : null;
  const out = items.filter(
    (i) =>
      i.relevance !== "excluded" &&
      (!f.relevance || i.relevance === f.relevance) &&
      (!f.stage || i.stage === f.stage) &&
      (!f.source || i.source_id === f.source) &&
      (since === null || (i.launched_at != null && new Date(i.launched_at).getTime() >= since)) &&
      matchesText([i.name, i.description, i.website_url], f.text),
  );
  if (f.sort === "name") return out.sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  const time = (v: string | null) => (v ? new Date(v).getTime() : 0);
  if (f.sort === "start") return out.sort((a, b) => time(b.launched_at) - time(a.launched_at));
  return out.sort((a, b) => time(b.first_discovered_at) - time(a.first_discovered_at));
}

// ---------- Future Radar ----------

export const RADAR_OUTLOOKS = [
  { value: "", label: "Alle Einschätzungen" },
  { value: "rising", label: "steigend" },
  { value: "emerging", label: "neu aufgetaucht" },
  { value: "stable", label: "stabil" },
  { value: "falling", label: "rückläufig" },
  { value: "too_little", label: "zu wenig Daten" },
] as const;

export const RADAR_SORTS = [
  { value: "", label: "Meiste Treffer diese Woche" },
  { value: "change", label: "Grösste Zunahme" },
  { value: "name", label: "Name A–Z" },
] as const;

export type RadarFilters = { text: string; outlook: Value<typeof RADAR_OUTLOOKS>; sort: Value<typeof RADAR_SORTS> };

export function parseRadarFilters(params: Params): RadarFilters {
  return {
    // Eigene Parameternamen, weil auf derselben Seite auch die Feed-Liste filtert (filter, sortierung …).
    text: (one(params.thema) ?? "").slice(0, 100),
    outlook: pick(RADAR_OUTLOOKS, one(params.einschaetzung)),
    sort: pick(RADAR_SORTS, one(params.reihenfolge)),
  };
}

export function hasRadarFilters(f: RadarFilters) {
  return Boolean(f.text || f.outlook || f.sort);
}

export type FilterableTopic = { term: string; note: string | null; outlook: string; current: number; previous: number };

export function filterTopics<T extends FilterableTopic>(topics: T[], f: RadarFilters): T[] {
  const out = topics.filter((t) => (!f.outlook || t.outlook === f.outlook) && matchesText([t.term, t.note], f.text));
  if (f.sort === "name") return out.sort((a, b) => a.term.localeCompare(b.term, "de-CH"));
  if (f.sort === "change") return out.sort((a, b) => b.current - b.previous - (a.current - a.previous));
  return out.sort((a, b) => b.current - a.current);
}

export function resultLabel(shown: number, total: number, noun: [string, string] = ["Eintrag", "Einträge"]) {
  const word = (n: number) => (n === 1 ? noun[0] : noun[1]);
  return shown === total ? `${total} ${word(total)}` : `${shown} von ${total} ${word(total)}`;
}

// ---------- Produkt-Bibliothek ----------

export const LIBRARY_PAGE_SIZE = 48;

export const LIBRARY_SORTS = [
  { value: "", label: "Meiste Übernahmen" },
  { value: "neu", label: "Neu beim Lieferanten" },
  { value: "gefunden", label: "Zuletzt gefunden" },
  { value: "preis", label: "Preis aufsteigend" },
  { value: "ki", label: "Beste KI-Bewertung" },
] as const;

export const LIBRARY_PRICES = [
  { value: "", label: "Alle Preise" },
  { value: "5", label: "bis 5 USD" },
  { value: "10", label: "bis 10 USD" },
  { value: "20", label: "bis 20 USD" },
  { value: "50", label: "bis 50 USD" },
] as const;

export const LIBRARY_RELEVANCE = [
  { value: "", label: "Ohne Ausgeschlossene" },
  { value: "empfohlen", label: "Von KI empfohlen (4–5)" },
  { value: "unklar", label: "Nur unklare" },
  { value: "ausgeschlossen", label: "Nur ausgeschlossene" },
  { value: "alle", label: "Alle" },
] as const;

export type LibraryFilters = {
  text: string;
  /** Nur Treffer eines Suchbegriffs (Live-Suche oder täglicher Begriff). */
  term: string;
  maxPrice: number | null;
  relevance: "" | "empfohlen" | "unklar" | "ausgeschlossen" | "alle";
  sort: "" | "neu" | "gefunden" | "preis" | "ki";
  freeShipping: boolean;
  showHidden: boolean;
  page: number;
};

const pickOption = <T extends readonly { value: string }[]>(options: T, v: string | undefined) =>
  (options.some((o) => o.value === v) ? v : "") as T[number]["value"];

export function parseLibraryFilters(params: Params): LibraryFilters {
  const price = Number(one(params.preis));
  const page = Number(one(params.seite));
  return {
    text: (one(params.filter) ?? "").trim().slice(0, 100),
    term: (one(params.begriff) ?? "").trim().toLowerCase().slice(0, 80),
    maxPrice: LIBRARY_PRICES.some((p) => p.value !== "" && Number(p.value) === price) ? price : null,
    relevance: pickOption(LIBRARY_RELEVANCE, one(params.relevanz)),
    sort: pickOption(LIBRARY_SORTS, one(params.sortierung)),
    freeShipping: one(params.gratisversand) === "1",
    showHidden: one(params.ausgeblendet) === "1",
    page: Number.isInteger(page) && page > 1 && page <= 200 ? page : 1,
  };
}

export function hasLibraryFilters(f: LibraryFilters) {
  return Boolean(f.text || f.term || f.maxPrice || f.relevance || f.sort || f.freeShipping || f.showHidden);
}

/** Suchbegriff für eine ilike-Abfrage: Sonderzeichen von PostgREST und LIKE entfernen. */
export function likePattern(text: string) {
  const clean = text.replace(/[%_\\,()*:"']/g, " ").replace(/\s+/g, " ").trim();
  return clean ? `%${clean.split(" ").join("%")}%` : null;
}

/** URL-Parameter einer Bibliotheksseite (für Blättern), leere Werte weglassen. */
export function libraryQuery(f: LibraryFilters, page: number) {
  const q = new URLSearchParams();
  if (f.text) q.set("filter", f.text);
  if (f.term) q.set("begriff", f.term);
  if (f.maxPrice) q.set("preis", String(f.maxPrice));
  if (f.relevance) q.set("relevanz", f.relevance);
  if (f.sort) q.set("sortierung", f.sort);
  if (f.freeShipping) q.set("gratisversand", "1");
  if (f.showHidden) q.set("ausgeblendet", "1");
  if (page > 1) q.set("seite", String(page));
  return q.toString();
}
