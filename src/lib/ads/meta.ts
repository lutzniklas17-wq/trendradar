/**
 * Meta Ad Library API (Graph API, Endpoint ads_archive).
 * Reine Funktionen ohne Netzwerk: Eingaben prüfen, Anfrage bauen, Antwort auslesen.
 * Doku: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 *       https://developers.facebook.com/docs/graph-api/reference/archived-ad/
 *
 * Wichtig: Normale (nicht politische) Anzeigen liefert die API nur, wenn sie in der EU ausgespielt wurden.
 * Die Schweiz ist nicht abgedeckt. Umsatz, Ausgaben oder Impressionen gibt es für Produktanzeigen nicht.
 */

export const META_SOURCE_ID = "meta_ad_library";
export const DEFAULT_GRAPH_VERSION = "v26.0";
export const MAX_SEARCH_LENGTH = 100;
export const PAGE_SIZE = 25;

/** Länder, für die Meta normale Anzeigen liefert (EU). Auswahl der für dich relevanten Märkte. */
export const AD_COUNTRIES = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "FR", label: "Frankreich" },
  { code: "IT", label: "Italien" },
  { code: "NL", label: "Niederlande" },
  { code: "ES", label: "Spanien" },
  { code: "PL", label: "Polen" },
  { code: "SE", label: "Schweden" },
] as const;

export const AD_STATUSES = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "ALL", label: "Aktiv und beendet" },
  { value: "INACTIVE", label: "Beendet" },
] as const;

export const AD_PLATFORMS = [
  { value: "", label: "Alle" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
] as const;

export const AD_SEARCH_TYPES = [
  { value: "KEYWORD_UNORDERED", label: "Alle Wörter" },
  { value: "KEYWORD_EXACT_PHRASE", label: "Genaue Wortfolge" },
] as const;

export type AdCountry = (typeof AD_COUNTRIES)[number]["code"];
export type AdStatus = (typeof AD_STATUSES)[number]["value"];
export type AdPlatform = (typeof AD_PLATFORMS)[number]["value"];
export type AdSearchType = (typeof AD_SEARCH_TYPES)[number]["value"];

export type AdQuery = {
  terms: string;
  country: AdCountry;
  status: AdStatus;
  platform: AdPlatform;
  searchType: AdSearchType;
  /** Cursor für die nächste Seite (von Meta geliefert). */
  after?: string;
};

export type MetaAd = {
  id: string;
  pageId: string | null;
  pageName: string | null;
  bodies: string[];
  linkTitles: string[];
  linkCaptions: string[];
  linkDescriptions: string[];
  createdAt: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  platforms: string[];
  languages: string[];
  /** Geschätzte Reichweite in der EU laut Meta (nur für EU-Anzeigen). */
  euReach: number | null;
  /** Öffentlicher Link zur Anzeige in der Ad Library, ohne Token. */
  libraryUrl: string;
};

export type AdSearchResult = { ads: MetaAd[]; nextCursor: string | null };

export class MetaAdError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "MetaAdError";
  }
}

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
  "languages",
  "eu_total_reach",
];

const pick = <T extends readonly { value?: string; code?: string }[]>(list: T, v: unknown) =>
  typeof v === "string" && list.some((x) => (x.value ?? x.code) === v);

export const isAdCountry = (v: unknown): v is AdCountry => pick(AD_COUNTRIES, v);
export const isAdStatus = (v: unknown): v is AdStatus => pick(AD_STATUSES, v);
export const isAdPlatform = (v: unknown): v is AdPlatform => pick(AD_PLATFORMS, v);
export const isAdSearchType = (v: unknown): v is AdSearchType => pick(AD_SEARCH_TYPES, v);

/** Leerzeichen zusammenfassen. */
export function normalizeTerms(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

/** Gibt eine Fehlermeldung oder null zurück. */
export function validateTerms(terms: string): string | null {
  if (!terms) return "Bitte einen Suchbegriff eingeben.";
  if (terms.length > MAX_SEARCH_LENGTH) return `Höchstens ${MAX_SEARCH_LENGTH} Zeichen (Vorgabe von Meta).`;
  return null;
}

/** Baut die Abfrage-URL ohne Token. Das Token wird erst beim Abruf angehängt. */
export function buildSearchUrl(query: AdQuery, graphVersion = DEFAULT_GRAPH_VERSION): URL {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/ads_archive`);
  const p = url.searchParams;
  p.set("search_terms", query.terms);
  p.set("search_type", query.searchType);
  p.set("ad_reached_countries", JSON.stringify([query.country]));
  p.set("ad_type", "ALL");
  p.set("ad_active_status", query.status);
  if (query.platform) p.set("publisher_platforms", JSON.stringify([query.platform]));
  p.set("fields", FIELDS.join(","));
  p.set("limit", String(PAGE_SIZE));
  if (query.after) p.set("after", query.after);
  return url;
}

/** Öffentlicher Link zur Anzeige. ad_snapshot_url von Meta enthält das Token und darf nie in den Browser. */
export function libraryUrl(adId: string) {
  return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adId)}`;
}

/** Suche direkt in der Ad Library im Browser (funktioniert ohne Token, auch für die Schweiz). */
export function librarySearchUrl(terms: string, country: string) {
  const u = new URL("https://www.facebook.com/ads/library/");
  u.searchParams.set("active_status", "active");
  u.searchParams.set("ad_type", "all");
  u.searchParams.set("country", country);
  u.searchParams.set("q", terms);
  u.searchParams.set("search_type", "keyword_unordered");
  u.searchParams.set("media_type", "all");
  return u.toString();
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

/** Liest eine Antwort von ads_archive aus. Wirft MetaAdError bei Fehlerantworten. */
export function parseSearchResponse(json: unknown): AdSearchResult {
  if (!json || typeof json !== "object") throw new MetaAdError("Unerwartete Antwort von Meta.");
  const body = json as { data?: unknown; paging?: { cursors?: { after?: unknown }; next?: unknown }; error?: unknown };
  if (body.error) throw toMetaError(body.error);
  if (!Array.isArray(body.data)) throw new MetaAdError("Unerwartete Antwort von Meta (keine Liste).");

  const ads: MetaAd[] = [];
  for (const row of body.data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id);
    if (!id) continue;
    ads.push({
      id,
      pageId: str(r.page_id),
      pageName: str(r.page_name),
      bodies: strings(r.ad_creative_bodies),
      linkTitles: strings(r.ad_creative_link_titles),
      linkCaptions: strings(r.ad_creative_link_captions),
      linkDescriptions: strings(r.ad_creative_link_descriptions),
      createdAt: str(r.ad_creation_time),
      startedAt: str(r.ad_delivery_start_time),
      stoppedAt: str(r.ad_delivery_stop_time),
      platforms: strings(r.publisher_platforms),
      languages: strings(r.languages),
      euReach: num(r.eu_total_reach),
      libraryUrl: libraryUrl(id),
    });
  }
  // Meta liefert "next" nur, wenn es weitere Treffer gibt.
  const after = str(body.paging?.cursors?.after);
  const nextCursor = after && body.paging?.next && ads.length ? after : null;
  return { ads, nextCursor };
}

/** Übersetzt Fehler der Graph API in verständliche Meldungen. */
export function toMetaError(error: unknown): MetaAdError {
  const e = (error ?? {}) as { code?: unknown; error_subcode?: unknown; message?: unknown };
  const code = typeof e.code === "number" ? e.code : undefined;
  if (code === 190) return new MetaAdError("Das Meta-Token ist ungültig oder abgelaufen. Bitte ein neues Token in Vercel eintragen.", code);
  if (code === 613 || code === 4 || code === 17 || code === 32)
    return new MetaAdError("Meta-Abfragelimit erreicht. Bitte in etwa einer Stunde erneut versuchen.", code);
  if (code === 10 || code === 200)
    return new MetaAdError(
      "Keine Berechtigung für die Ad Library API. Ist die Identitätsbestätigung bei Meta abgeschlossen?",
      code,
    );
  if (code === 100 || code === 1009 || code === 2500)
    return new MetaAdError("Meta hat die Suchanfrage abgelehnt (ungültiger Parameter).", code);
  return new MetaAdError("Meta hat einen Fehler gemeldet.", code);
}

/** Ganze Tage, die eine Anzeige läuft oder lief. Null ohne Startdatum. */
export function runningDays(ad: Pick<MetaAd, "startedAt" | "stoppedAt">, now = new Date()): number | null {
  if (!ad.startedAt) return null;
  const start = Date.parse(ad.startedAt);
  if (Number.isNaN(start)) return null;
  const stop = ad.stoppedAt ? Date.parse(ad.stoppedAt) : NaN;
  const end = Number.isNaN(stop) ? now.getTime() : Math.min(stop, now.getTime());
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

/** Ab so vielen Tagen Laufzeit gilt eine Anzeige als Signal (Werbetreibende lassen meist nur rentable Anzeigen lange laufen). */
export const LONG_RUNNING_DAYS = 30;

/**
 * Fasst Treffer nach Werbetreibendem zusammen: Anzahl Anzeigen und längste Laufzeit.
 * Viele gleichzeitige Anzeigen einer Seite sind ein Signal, kein Beweis für Umsatz.
 */
export function groupByAdvertiser(ads: MetaAd[], now = new Date()) {
  const map = new Map<string, { pageId: string | null; pageName: string; count: number; longestDays: number | null }>();
  for (const ad of ads) {
    const key = ad.pageId ?? ad.pageName ?? ad.id;
    const days = runningDays(ad, now);
    const g = map.get(key) ?? { pageId: ad.pageId, pageName: ad.pageName ?? "Unbekannte Seite", count: 0, longestDays: null };
    g.count += 1;
    if (days !== null && (g.longestDays === null || days > g.longestDays)) g.longestDays = days;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (b.longestDays ?? 0) - (a.longestDays ?? 0));
}
