import type { SupabaseClient } from "@supabase/supabase-js";
import { EU_COUNTRIES } from "@/lib/ads/meta";

// Eigene Rangliste aus den gesammelten Daten (Migration 0005). Die Meta-API selbst liefert keine Rangliste.

export const RANK_VIEWS = [
  { value: "werbetreibende", label: "Werbetreibende" },
  { value: "anzeigen", label: "Einzelne Anzeigen" },
] as const;

export const ADVERTISER_SORTS = [
  { value: "active", label: "Meiste aktive Anzeigen jetzt" },
  { value: "new", label: "Meiste neue Anzeigen (7 Tage)" },
  { value: "longest", label: "Längste Laufzeit" },
  { value: "newest", label: "Neueste Anzeige" },
] as const;

export const AD_SORTS = [
  { value: "longest", label: "Längste Laufzeit" },
  { value: "newest", label: "Neueste zuerst" },
  { value: "reach", label: "Grösste EU-Reichweite" },
] as const;

export const RANK_WINDOWS = [
  { value: "2", label: "Heute und gestern" },
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
] as const;

export const RANK_PLATFORMS = [
  { value: "", label: "Alle" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "MESSENGER", label: "Messenger" },
  { value: "AUDIENCE_NETWORK", label: "Audience Network" },
] as const;

export type RankFilters = {
  view: (typeof RANK_VIEWS)[number]["value"];
  sort: string;
  days: number;
  country: string | null;
  platform: string | null;
  termId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : "");
const pick = <T extends { value: string }>(list: readonly T[], v: string, fallback: T["value"]) =>
  list.some((x) => x.value === v) ? (v as T["value"]) : fallback;

/** Liest die Filter aus der URL. Ungültige Werte fallen auf den Standard zurück. */
export function parseRankFilters(params: Record<string, unknown>): RankFilters {
  const view = pick(RANK_VIEWS, one(params.ansicht), "werbetreibende");
  const sort = view === "anzeigen" ? pick(AD_SORTS, one(params.sortierung), "longest") : pick(ADVERTISER_SORTS, one(params.sortierung), "active");
  const country = one(params.land).toUpperCase();
  const platform = pick(RANK_PLATFORMS, one(params.plattform), "");
  const term = one(params.stichwort);
  return {
    view,
    sort,
    days: Number(pick(RANK_WINDOWS, one(params.zeitraum), "2")),
    // "EU" = Sichtungen aus der Shop-Zählung (alle EU-Länder zusammen)
    country: (EU_COUNTRIES as readonly string[]).includes(country) || country === "EU" ? country : null,
    platform: platform || null,
    termId: UUID.test(term) ? term : null,
  };
}

export type RankedAdvertiser = {
  advertiser_id: string;
  page_id: string;
  name: string;
  active_ads: number;
  new_ads: number;
  longest_days: number | null;
  newest_start: string | null;
  countries: string[] | null;
  platforms: string[] | null;
  tracked_shop_id: string | null;
};

export type RankedAd = {
  id: string;
  external_id: string;
  advertiser_id: string | null;
  advertiser_name: string | null;
  page_id: string | null;
  body: string | null;
  title: string | null;
  snapshot_url: string | null;
  publisher_platforms: string[] | null;
  started_at: string | null;
  eu_reach: number | null;
  running_days: number | null;
  countries: string[] | null;
  last_seen: string | null;
};

const base = (f: RankFilters) => ({ p_days: f.days, p_country: f.country, p_platform: f.platform, p_term_id: f.termId });

export async function rankAdvertisers(supabase: SupabaseClient, f: RankFilters, limit = 50) {
  const { data, error } = await supabase.rpc("ad_rank_advertisers", { ...base(f), p_sort: f.sort, p_limit: limit });
  return { rows: (data ?? []) as RankedAdvertiser[], error: error ? "Rangliste konnte nicht geladen werden. Ist die Migration 0005 in Supabase gelaufen?" : null };
}

export async function rankAds(supabase: SupabaseClient, f: RankFilters & { advertiserId?: string | null }, limit = 50) {
  const { data, error } = await supabase.rpc("ad_rank_ads", { ...base(f), p_advertiser_id: f.advertiserId ?? null, p_sort: f.sort, p_limit: limit });
  return { rows: (data ?? []) as RankedAd[], error: error ? "Anzeigen konnten nicht geladen werden. Ist die Migration 0005 in Supabase gelaufen?" : null };
}

/** URL der Rangliste mit geänderten Filtern (für Links und Sortier-Tabs). */
export function rankHref(f: RankFilters, change: Partial<RankFilters> = {}) {
  const n = { ...f, ...change };
  const p = new URLSearchParams();
  if (n.view !== "werbetreibende") p.set("ansicht", n.view);
  p.set("sortierung", n.sort);
  if (n.days !== 2) p.set("zeitraum", String(n.days));
  if (n.country) p.set("land", n.country);
  if (n.platform) p.set("plattform", n.platform);
  if (n.termId) p.set("stichwort", n.termId);
  return `/ad-spy/rangliste?${p}`;
}
