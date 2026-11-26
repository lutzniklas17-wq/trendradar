/**
 * Google Trends über DataForSEO (Endpoint keywords_data/google_trends/explore/live).
 * Reine Funktionen ohne Netzwerk: Eingaben prüfen, Anfrage bauen, Antwort auslesen.
 * Doku: https://docs.dataforseo.com/v3/keywords_data/google_trends/explore/live/
 *
 * Wichtig: Google Trends liefert relative Werte (100 = höchster Punkt im gewählten Zeitraum),
 * keine absoluten Suchvolumen.
 */

export const DATAFORSEO_EXPLORE_URL = "https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live";
export const TRENDS_SOURCE_ID = "dataforseo_trends";
export const MAX_KEYWORDS = 5;

/** Regionen als DataForSEO-Standortcode. Leer = weltweit. */
export const TREND_GEOS = [
  { code: "2756", label: "Schweiz" },
  { code: "2276", label: "Deutschland" },
  { code: "2040", label: "Österreich" },
  { code: "2840", label: "USA" },
  { code: "2826", label: "Grossbritannien" },
  { code: "", label: "Weltweit" },
] as const;

export const TREND_TIME_RANGES = [
  { value: "past_30_days", label: "30 Tage" },
  { value: "past_90_days", label: "90 Tage" },
  { value: "past_12_months", label: "12 Monate" },
  { value: "past_5_years", label: "5 Jahre" },
] as const;

export type TrendGeo = (typeof TREND_GEOS)[number]["code"];
export type TrendTimeRange = (typeof TREND_TIME_RANGES)[number]["value"];

export type TrendQuery = { keywords: string[]; geo: TrendGeo; timeRange: TrendTimeRange };

export type TrendPoint = {
  dateFrom: string;
  dateTo: string;
  /** Ein Wert je Suchbegriff (0–100), null wenn Google für diesen Punkt keine Daten hat. */
  values: (number | null)[];
};

export type TrendResult = {
  keywords: string[];
  points: TrendPoint[];
  /** Durchschnitt je Suchbegriff über den ganzen Zeitraum, falls geliefert. */
  averages: (number | null)[];
  /** Link zur gleichen Abfrage auf trends.google.com (von DataForSEO geliefert). */
  checkUrl: string | null;
  /** Zeitpunkt der Abfrage laut DataForSEO. */
  sourceDatetime: string | null;
  /** Kosten der Abfrage in USD laut DataForSEO. */
  costUsd: number | null;
};

export class DataForSeoError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }
}

const FORBIDDEN = /[<>|"\-+=~!:*()[\]{}\\]/;

/** Zerlegt eine Eingabe wie „red light mask, led maske“ in bereinigte Suchbegriffe. */
export function parseKeywordInput(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const keyword = part.trim().replace(/\s+/g, " ").toLowerCase();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
  }
  return result;
}

/** Prüft die Regeln von DataForSEO. Gibt eine verständliche Fehlermeldung zurück oder null. */
export function validateKeywords(keywords: string[]): string | null {
  if (keywords.length === 0) return "Bitte mindestens einen Suchbegriff eingeben.";
  if (keywords.length > MAX_KEYWORDS) return `Höchstens ${MAX_KEYWORDS} Suchbegriffe gleichzeitig.`;
  for (const k of keywords) {
    if (k.length < 2) return `„${k}“ ist zu kurz (mindestens 2 Zeichen).`;
    if (k.length > 100) return `„${k.slice(0, 20)}…“ ist zu lang (höchstens 100 Zeichen).`;
    if (FORBIDDEN.test(k)) return `„${k}“ enthält Sonderzeichen, die Google Trends nicht erlaubt (z. B. - + " : ( )).`;
  }
  return null;
}

export function isTrendGeo(value: unknown): value is TrendGeo {
  return TREND_GEOS.some((g) => g.code === value);
}

export function isTrendTimeRange(value: unknown): value is TrendTimeRange {
  return TREND_TIME_RANGES.some((t) => t.value === value);
}

/** Anfragekörper für DataForSEO: ein Array mit genau einer Aufgabe. */
export function buildExploreTask(query: TrendQuery) {
  return [
    {
      keywords: query.keywords,
      ...(query.geo ? { location_code: Number(query.geo) } : {}),
      type: "web",
      time_range: query.timeRange,
      item_types: ["google_trends_graph"],
    },
  ];
}

/** Postgres-Array-Literal für den Cache-Abgleich (Begriffe enthalten nach der Prüfung keine Anführungszeichen). */
export function toPgArrayLiteral(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const toNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function toValues(raw: unknown, count: number, missing: boolean): (number | null)[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return Array.from({ length: count }, (_, i) => (missing ? null : toNum(list[i])));
}

/** Liest die Antwort von DataForSEO aus. Wirft DataForSeoError bei Fehlern statt Werte zu raten. */
export function parseExploreResponse(json: unknown, keywords: string[]): TrendResult {
  if (!isObj(json)) throw new DataForSeoError("Unerwartete Antwort von DataForSEO.");
  const status = toNum(json.status_code);
  if (status !== 20000) {
    throw new DataForSeoError(String(json.status_message ?? "Unbekannter Fehler"), status ?? undefined);
  }
  const task = Array.isArray(json.tasks) ? json.tasks[0] : undefined;
  if (!isObj(task)) throw new DataForSeoError("DataForSEO hat keine Aufgabe zurückgegeben.");
  const taskStatus = toNum(task.status_code);
  if (taskStatus !== 20000) {
    throw new DataForSeoError(String(task.status_message ?? "Aufgabe fehlgeschlagen"), taskStatus ?? undefined);
  }

  const result = Array.isArray(task.result) ? task.result[0] : undefined;
  const items = isObj(result) && Array.isArray(result.items) ? result.items : [];
  const graph = items.find((i): i is Obj => isObj(i) && i.type === "google_trends_graph");
  const resultKeywords =
    isObj(graph) && Array.isArray(graph.keywords) && graph.keywords.every((k) => typeof k === "string")
      ? (graph.keywords as string[])
      : keywords;
  const count = resultKeywords.length;

  const points: TrendPoint[] = [];
  for (const row of graph && Array.isArray(graph.data) ? graph.data : []) {
    if (!isObj(row) || typeof row.date_from !== "string") continue;
    points.push({
      dateFrom: row.date_from,
      dateTo: typeof row.date_to === "string" ? row.date_to : row.date_from,
      values: toValues(row.values, count, row.missing_data === true),
    });
  }

  return {
    keywords: resultKeywords,
    points,
    averages: toValues(graph?.averages, count, !Array.isArray(graph?.averages)),
    checkUrl: isObj(result) && typeof result.check_url === "string" ? result.check_url : null,
    sourceDatetime: isObj(result) && typeof result.datetime === "string" ? result.datetime : null,
    costUsd: toNum(task.cost) ?? toNum(json.cost),
  };
}

/** Einfache, nachvollziehbare Kennzahl: Mittel der letzten Punkte gegenüber den ersten (gleich viele Punkte). */
export function trendDirection(points: TrendPoint[], index: number): { first: number; last: number } | null {
  const vals = points.map((p) => p.values[index]).filter((v): v is number => v !== null);
  if (vals.length < 6) return null;
  const n = Math.max(1, Math.floor(vals.length / 4));
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return { first: Math.round(avg(vals.slice(0, n))), last: Math.round(avg(vals.slice(-n))) };
}
