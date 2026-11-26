import type { SupabaseClient } from "@supabase/supabase-js";
import { zurichDay } from "@/lib/shops/shops";

// Anzeigen-Karten, Tagesauswahl und Shop-Kennzahlen für Startseite, Rangliste und Anzeigen-Detail.
// Alle Zahlen stammen aus den selbst gesammelten Meta-Daten. Nichts wird geschätzt.

/** Eine Anzeige, wie sie eine Karte braucht. */
export type AdCardData = {
  id: string;
  external_id: string;
  advertiser_id: string | null;
  advertiser_name: string | null;
  page_id: string | null;
  title: string | null;
  body: string | null;
  domain: string | null;
  publisher_platforms: string[] | null;
  started_at: string | null;
  stopped_at: string | null;
  eu_reach: number | null;
  /** Länder, in denen TrendRadar die Anzeige aktiv gesehen hat. */
  countries: string[] | null;
  /** Bekannte Anzeigen des Werbetreibenden (nur was TrendRadar gesehen hat). */
  stats: AdvertiserStats | null;
};

export type AdvertiserStats = { active: number; total: number };

export const HOME_TABS = [
  { value: "anzeigen", label: "Anzeigen" },
  { value: "shops", label: "Shops" },
  { value: "produkte", label: "Produkte" },
] as const;
export type HomeTab = (typeof HOME_TABS)[number]["value"];

/** Anzahl Tage in der Tagesauswahl auf der Startseite. */
export const HOME_DAYS = 10;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : "");

/** Die letzten `n` Kalendertage bis `today` (älteste zuerst), als YYYY-MM-DD. */
export function lastDays(today: string, n: number): string[] {
  const base = Date.parse(`${today}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** Liest Tag und Tab der Startseite aus der URL. Nur Tage aus der Auswahl sind erlaubt. */
export function parseHomeParams(params: Record<string, unknown>, today = zurichDay()) {
  const days = lastDays(today, HOME_DAYS);
  const day = one(params.tag);
  const tab = one(params.ansicht);
  return {
    days,
    day: ISO_DAY.test(day) && days.includes(day) ? day : today,
    tab: (HOME_TABS.some((t) => t.value === tab) ? tab : "anzeigen") as HomeTab,
  };
}

export function homeHref(day: string, tab: HomeTab, today = zurichDay()) {
  const p = new URLSearchParams();
  if (day !== today) p.set("tag", day);
  if (tab !== "anzeigen") p.set("ansicht", tab);
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

/** Kurzer Wochentag (Mo, Di …) eines Tages. */
export function weekdayShort(day: string) {
  return new Intl.DateTimeFormat("de-CH", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "");
}

/** Laufzeit in ganzen Tagen (mind. 1) von Start bis Ende oder bis jetzt. */
export function runningDays(startedAt: string | null, stoppedAt: string | null, now = new Date()): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  const end = stoppedAt ? Date.parse(stoppedAt) : now.getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

/** Zählt pro Werbetreibendem die bekannten Anzeigen und davon die noch laufenden (ohne Enddatum). */
export function aggregateAdvertiserStats(rows: { advertiser_id: string | null; stopped_at: string | null }[]) {
  const map = new Map<string, AdvertiserStats>();
  for (const r of rows) {
    if (!r.advertiser_id) continue;
    const s = map.get(r.advertiser_id) ?? { active: 0, total: 0 };
    s.total += 1;
    if (!r.stopped_at) s.active += 1;
    map.set(r.advertiser_id, s);
  }
  return map;
}

/** https-Link zur Shop-Domain aus der Link-Beschriftung, oder null bei ungültiger Domain. */
export function domainUrl(domain: string | null) {
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
  return `https://${domain.toLowerCase()}`;
}

/**
 * Offizielle Vorschau-Seite von Meta (dieselbe Seite wie `ad_snapshot_url` aus der API).
 * Enthält das Token: nur serverseitig bauen und nur für den angemeldeten Besitzer weiterleiten.
 */
export function renderAdUrl(adId: string, accessToken: string) {
  const u = new URL("https://www.facebook.com/ads/archive/render_ad/");
  u.searchParams.set("id", adId);
  u.searchParams.set("access_token", accessToken);
  return u.toString();
}

/** Beginn und Ende eines Zürcher Kalendertags als ISO-Zeitpunkte (Sommer- und Winterzeit). */
export function zurichDayRange(day: string) {
  const noon = new Date(`${day}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", timeZoneName: "longOffset" })
    .formatToParts(noon)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = part?.replace("GMT", "") || "+00:00";
  const start = new Date(`${day}T00:00:00${offset}`);
  return { from: start.toISOString(), to: new Date(start.getTime() + 86_400_000).toISOString() };
}

// ---------- Datenbank ----------

type AdRow = {
  id: string;
  external_id: string;
  advertiser_id: string | null;
  title: string | null;
  body: string | null;
  domain?: string | null;
  publisher_platforms: string[] | null;
  started_at: string | null;
  stopped_at: string | null;
  eu_reach: number | null;
  advertisers: { name: string; external_id: string } | { name: string; external_id: string }[] | null;
  ad_sightings?: { country: string }[] | null;
};

const AD_COLUMNS = "id, external_id, advertiser_id, title, body, publisher_platforms, started_at, stopped_at, eu_reach, advertisers(name, external_id)";

function toCard(r: AdRow, stats: Map<string, AdvertiserStats>): AdCardData {
  const adv = Array.isArray(r.advertisers) ? r.advertisers[0] : r.advertisers;
  const countries = [...new Set((r.ad_sightings ?? []).map((s) => s.country))].sort();
  return {
    id: r.id,
    external_id: r.external_id,
    advertiser_id: r.advertiser_id,
    advertiser_name: adv?.name ?? null,
    page_id: adv?.external_id ?? null,
    title: r.title,
    body: r.body,
    domain: r.domain ?? null,
    publisher_platforms: r.publisher_platforms,
    started_at: r.started_at,
    stopped_at: r.stopped_at,
    eu_reach: r.eu_reach,
    countries: countries.length ? countries : null,
    stats: r.advertiser_id ? (stats.get(r.advertiser_id) ?? null) : null,
  };
}

/** Ohne Migration 0007 fehlt die Spalte `domain`: dann ohne Domain abfragen. */
async function selectAds(build: (columns: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>, extra = "") {
  let res = await build(`${AD_COLUMNS}, domain${extra}`);
  if (res.error && /domain/i.test(res.error.message ?? "")) res = await build(`${AD_COLUMNS}${extra}`);
  return { rows: (res.data ?? []) as AdRow[], error: res.error };
}

export async function advertiserStats(supabase: SupabaseClient, advertiserIds: string[]) {
  const ids = [...new Set(advertiserIds)];
  if (!ids.length) return new Map<string, AdvertiserStats>();
  const { data } = await supabase.from("ads").select("advertiser_id, stopped_at").in("advertiser_id", ids).limit(10_000);
  return aggregateAdvertiserStats((data ?? []) as { advertiser_id: string | null; stopped_at: string | null }[]);
}

/** Karten zu bekannten Anzeigen-IDs, in der übergebenen Reihenfolge. */
export async function loadAdCards(supabase: SupabaseClient, ids: string[], countries?: Map<string, string[] | null>) {
  if (!ids.length) return { cards: [] as AdCardData[], error: null };
  const { rows, error } = await selectAds((c) => supabase.from("ads").select(c).in("id", ids));
  const stats = await advertiserStats(supabase, rows.map((r) => r.advertiser_id).filter((x): x is string => Boolean(x)));
  const byId = new Map(rows.map((r) => [r.id, toCard(r, stats)]));
  const cards = ids.flatMap((id) => {
    const card = byId.get(id);
    if (!card) return [];
    const seen = countries?.get(id);
    return [seen ? { ...card, countries: seen } : card];
  });
  return { cards, error: error ? "Anzeigen konnten nicht geladen werden." : null };
}

/** Anzeigen, die an einem Tag aktiv gesehen wurden, sortiert nach EU-Reichweite (Angabe von Meta). */
export async function topAdsOfDay(supabase: SupabaseClient, day: string, limit = 10) {
  const { rows, error } = await selectAds(
    (c) =>
      supabase
        .from("ads")
        .select(c)
        .eq("ad_sightings.day", day)
        .order("eu_reach", { ascending: false, nullsFirst: false })
        .order("started_at", { ascending: true })
        .limit(limit),
    ", ad_sightings!inner(country)",
  );
  const stats = await advertiserStats(supabase, rows.map((r) => r.advertiser_id).filter((x): x is string => Boolean(x)));
  return {
    cards: rows.map((r) => toCard(r, stats)),
    error: error ? "Anzeigen konnten nicht geladen werden. Sind die Migrationen 0004 und 0007 in Supabase gelaufen?" : null,
  };
}

export type DayCover = { day: string; ads: number; topAdvertiser: string | null };

/** Für die Tagesauswahl: Anzahl aktiv gesehener Anzeigen pro Tag und der Werbetreibende mit der grössten Reichweite. */
export async function dayCovers(supabase: SupabaseClient, days: string[]): Promise<DayCover[]> {
  return Promise.all(
    days.map(async (day) => {
      const { data, count } = await supabase
        .from("ads")
        .select("id, advertisers(name), ad_sightings!inner(day)", { count: "exact" })
        .eq("ad_sightings.day", day)
        .order("eu_reach", { ascending: false, nullsFirst: false })
        .limit(1);
      const first = (data?.[0] ?? null) as { advertisers: { name: string } | { name: string }[] | null } | null;
      const adv = first ? (Array.isArray(first.advertisers) ? first.advertisers[0] : first.advertisers) : null;
      return { day, ads: count ?? 0, topAdvertiser: adv?.name ?? null };
    }),
  );
}

/** Weitere Anzeigen desselben Werbetreibenden (laufende zuerst). */
export async function adsOfAdvertiser(supabase: SupabaseClient, advertiserId: string, excludeId: string, limit = 12) {
  const { rows } = await selectAds((c) =>
    supabase
      .from("ads")
      .select(c)
      .eq("advertiser_id", advertiserId)
      .neq("id", excludeId)
      .order("stopped_at", { ascending: false, nullsFirst: true })
      .order("eu_reach", { ascending: false, nullsFirst: false })
      .limit(limit),
  );
  const stats = await advertiserStats(supabase, [advertiserId]);
  return rows.map((r) => toCard(r, stats));
}

/** Anzeigen anderer Werbetreibender, die über dieselben Stichwörter gefunden wurden. */
export async function similarAdsOfOthers(supabase: SupabaseClient, adId: string, advertiserId: string | null, limit = 12) {
  const { data: hits } = await supabase.from("ad_term_hits").select("term_id").eq("ad_id", adId);
  const termIds = [...new Set((hits ?? []).map((h: { term_id: string }) => h.term_id))];
  if (!termIds.length) return { cards: [] as AdCardData[], terms: 0 };
  const { data: others } = await supabase.from("ad_term_hits").select("ad_id").in("term_id", termIds).neq("ad_id", adId).limit(300);
  const ids = [...new Set((others ?? []).map((o: { ad_id: string }) => o.ad_id))];
  if (!ids.length) return { cards: [], terms: termIds.length };
  const { rows } = await selectAds((c) => {
    const q = supabase.from("ads").select(c).in("id", ids);
    return (advertiserId ? q.neq("advertiser_id", advertiserId) : q).order("eu_reach", { ascending: false, nullsFirst: false }).limit(limit);
  });
  const stats = await advertiserStats(supabase, rows.map((r) => r.advertiser_id).filter((x): x is string => Boolean(x)));
  return { cards: rows.map((r) => toCard(r, stats)), terms: termIds.length };
}

/** Anzeigen pro Produkt (items.id) über die Stichwörter des Produkts im Datensammler: laufend und bekannt. */
export async function itemAdCounts(supabase: SupabaseClient, itemIds: string[]) {
  const result = new Map<string, AdvertiserStats>();
  const ids = [...new Set(itemIds)];
  if (!ids.length) return result;
  const { data: terms } = await supabase.from("ad_watch_terms").select("id, item_id").in("item_id", ids);
  const termItem = new Map(((terms ?? []) as { id: string; item_id: string }[]).map((t) => [t.id, t.item_id]));
  if (!termItem.size) return result;
  const { data: hits } = await supabase.from("ad_term_hits").select("ad_id, term_id, ads(stopped_at)").in("term_id", [...termItem.keys()]).limit(5000);
  const seen = new Set<string>();
  for (const h of (hits ?? []) as { ad_id: string; term_id: string; ads: { stopped_at: string | null } | { stopped_at: string | null }[] | null }[]) {
    const item = termItem.get(h.term_id);
    if (!item || seen.has(`${item}:${h.ad_id}`)) continue;
    seen.add(`${item}:${h.ad_id}`);
    const ad = Array.isArray(h.ads) ? h.ads[0] : h.ads;
    const c = result.get(item) ?? { active: 0, total: 0 };
    c.total += 1;
    if (ad && !ad.stopped_at) c.active += 1;
    result.set(item, c);
  }
  return result;
}
