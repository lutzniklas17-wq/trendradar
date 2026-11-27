/**
 * Zusatzdaten zu einem Suchbegriff aus Google Trends (über DataForSEO):
 * Regionen (google_trends_map), verwandte Suchanfragen (google_trends_queries_list)
 * und verwandte Themen (google_trends_topics_list).
 * Doku: https://docs.dataforseo.com/v3/keywords_data/google_trends/explore/live/
 * Laut Doku gibt es Suchanfragen und Themen nur, wenn genau ein Begriff abgefragt wird.
 *
 * Dazu eine regelbasierte Einschätzung der Kurve („steigt stark“ usw.). Das ist eine
 * Rechnung aus den Messpunkten, keine Prognose.
 */
import { DataForSeoError, type TrendPoint, type TrendQuery } from "@/lib/trends/dataforseo";

/** Eigener Wert in trend_series.time_range, damit Kurve und Zusatzdaten getrennt zwischengespeichert werden. */
export const INSIGHTS_PREFIX = "insights:";

export type RelatedEntry = {
  label: string;
  /** Top: 0–100 relativ zum beliebtesten Eintrag. Steigend: Zunahme in Prozent. null = Google meldet „Breakout“ oder keinen Wert. */
  value: number | null;
  /** Thementyp laut Google, z. B. „Produkt“ (nur bei Themen). */
  kind?: string;
};

export type RegionEntry = { geoId: string; name: string; value: number };

export type TrendInsights = {
  keyword: string;
  regions: RegionEntry[];
  topQueries: RelatedEntry[];
  risingQueries: RelatedEntry[];
  topTopics: RelatedEntry[];
  risingTopics: RelatedEntry[];
  costUsd: number | null;
};

export function buildInsightsTask(query: TrendQuery) {
  return [
    {
      keywords: [query.keywords[0]],
      ...(query.geo ? { location_code: Number(query.geo) } : {}),
      type: "web",
      time_range: query.timeRange,
      item_types: ["google_trends_map", "google_trends_queries_list", "google_trends_topics_list"],
    },
  ];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Zahl oder Zahl als Text („350“, „+350%“). Alles andere (z. B. „Breakout“) → null. */
export function toNumberish(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[+%\s,']/g, "");
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  }
  return null;
}

function toEntries(list: unknown, labelKey: "query" | "topic_title"): RelatedEntry[] {
  if (!Array.isArray(list)) return [];
  const out: RelatedEntry[] = [];
  for (const row of list) {
    if (!isObj(row) || typeof row[labelKey] !== "string" || !String(row[labelKey]).trim()) continue;
    out.push({
      label: String(row[labelKey]).trim(),
      value: toNumberish(row.value),
      ...(typeof row.topic_type === "string" && row.topic_type ? { kind: row.topic_type } : {}),
    });
  }
  return out;
}

export function parseInsightsResponse(json: unknown, keyword: string): TrendInsights {
  if (!isObj(json)) throw new DataForSeoError("Unerwartete Antwort von DataForSEO.");
  if (json.status_code !== 20000) throw new DataForSeoError(String(json.status_message ?? "Unbekannter Fehler"));
  const task = Array.isArray(json.tasks) ? json.tasks[0] : undefined;
  if (!isObj(task)) throw new DataForSeoError("DataForSEO hat keine Aufgabe zurückgegeben.");
  if (task.status_code !== 20000) throw new DataForSeoError(String(task.status_message ?? "Aufgabe fehlgeschlagen"));

  const result = Array.isArray(task.result) ? task.result[0] : undefined;
  const items = isObj(result) && Array.isArray(result.items) ? result.items.filter(isObj) : [];
  const byType = (t: string) => items.find((i) => i.type === t);

  const map = byType("google_trends_map");
  const regions: RegionEntry[] = [];
  for (const row of map && Array.isArray(map.data) ? map.data : []) {
    if (!isObj(row) || typeof row.geo_name !== "string") continue;
    const raw = Array.isArray(row.values) ? row.values[0] : row.values;
    const value = toNumberish(raw);
    if (value === null || value <= 0) continue;
    regions.push({ geoId: typeof row.geo_id === "string" ? row.geo_id : row.geo_name, name: row.geo_name, value });
  }
  regions.sort((a, b) => b.value - a.value);

  const queries = byType("google_trends_queries_list");
  const topics = byType("google_trends_topics_list");
  const qData = queries && isObj(queries.data) ? queries.data : {};
  const tData = topics && isObj(topics.data) ? topics.data : {};

  const cost = typeof task.cost === "number" ? task.cost : typeof json.cost === "number" ? json.cost : null;
  return {
    keyword,
    regions,
    topQueries: toEntries(qData.top, "query"),
    risingQueries: toEntries(qData.rising, "query"),
    topTopics: toEntries(tData.top, "topic_title"),
    risingTopics: toEntries(tData.rising, "topic_title"),
    costUsd: cost,
  };
}

export type VerdictKey = "strong_up" | "up" | "flat" | "down" | "strong_down";

export type TrendVerdict = {
  key: VerdictKey;
  label: string;
  tone: "positive" | "negative" | "neutral";
  /** Mittel des ersten Viertels der Messpunkte. */
  first: number;
  /** Mittel des letzten Viertels der Messpunkte. */
  last: number;
  /** Veränderung in Prozent; null, wenn der Anfangswert 0 ist. */
  changePct: number | null;
  /** Letzter Messwert (0–100). */
  current: number;
  /** Datum des Höchstwerts (Beginn der Woche bzw. des Tages). */
  peakDate: string;
};

const LABELS: Record<VerdictKey, string> = {
  strong_up: "steigt stark",
  up: "steigt",
  flat: "stabil",
  down: "fällt",
  strong_down: "fällt stark",
};

/**
 * Regelbasierte Einschätzung: Mittel des letzten Viertels gegenüber dem ersten Viertel.
 * Ab +50 % „steigt stark“, ab +15 % „steigt“, ab −15 % „fällt“, ab −50 % „fällt stark“, sonst „stabil“.
 * Startet die Kurve bei 0 und endet bei mindestens 10, gilt sie als „steigt stark“.
 * Weniger als 6 Messpunkte → keine Einschätzung.
 */
export function trendVerdict(points: TrendPoint[], index: number): TrendVerdict | null {
  const rows = points
    .map((p) => ({ date: p.dateFrom, v: p.values[index] }))
    .filter((r): r is { date: string; v: number } => typeof r.v === "number");
  if (rows.length < 6) return null;
  const n = Math.max(1, Math.floor(rows.length / 4));
  const avg = (a: typeof rows) => a.reduce((s, r) => s + r.v, 0) / a.length;
  const first = avg(rows.slice(0, n));
  const last = avg(rows.slice(-n));
  const changePct = first > 0 ? ((last - first) / first) * 100 : null;

  let key: VerdictKey;
  if (changePct === null) key = last >= 10 ? "strong_up" : "flat";
  else if (changePct >= 50) key = "strong_up";
  else if (changePct >= 15) key = "up";
  else if (changePct <= -50) key = "strong_down";
  else if (changePct <= -15) key = "down";
  else key = "flat";

  const peak = rows.reduce((best, r) => (r.v > best.v ? r : best), rows[0]);
  return {
    key,
    label: LABELS[key],
    tone: key === "strong_up" || key === "up" ? "positive" : key === "flat" ? "neutral" : "negative",
    first: Math.round(first),
    last: Math.round(last),
    changePct: changePct === null ? null : Math.round(changePct),
    current: rows[rows.length - 1].v,
    peakDate: peak.date,
  };
}

/** Werte eines Begriffs für eine Mini-Kurve (fehlende Punkte als 0). */
export function seriesOf(points: TrendPoint[], index: number): number[] {
  return points.map((p) => p.values[index] ?? 0);
}
