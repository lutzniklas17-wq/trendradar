import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaEnv } from "@/lib/env";
import { adDomain, zurichDay } from "@/lib/shops/shops";
import { buildSearchUrl, META_SOURCE_ID, MetaAdError, parseSearchResponse, toMetaError, type AdQuery, type AdSearchResult, type MetaAd } from "@/lib/ads/meta";

export type AdLookup =
  | { status: "ok"; result: AdSearchResult; fetchedAt: string; saved: boolean }
  | { status: "not_configured" }
  | { status: "error"; message: string };

type FetchFn = typeof fetch;

/** Ruft die Ad Library API ab. Das Token steht nur in der Anfrage an Meta und wird nirgends gespeichert oder geloggt. */
export async function fetchAdsLive(
  query: AdQuery,
  creds: { accessToken: string; graphVersion?: string },
  fetchImpl: FetchFn = fetch,
): Promise<AdSearchResult> {
  return fetchArchive(buildSearchUrl(query, creds.graphVersion), creds.accessToken, fetchImpl);
}

/** Ruft eine fertig gebaute ads_archive-URL ab (Token wird hier angehängt) und liest die Antwort aus. */
export async function fetchArchive(url: URL, accessToken: string, fetchImpl: FetchFn = fetch): Promise<AdSearchResult> {
  url = new URL(url);
  url.searchParams.set("access_token", accessToken);
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new MetaAdError(`Meta antwortet mit HTTP ${res.status}.`, res.status);
  }
  if (!res.ok) {
    const err = (json as { error?: unknown } | null)?.error;
    throw err ? toMetaError(err) : new MetaAdError(`Meta antwortet mit HTTP ${res.status}.`, res.status);
  }
  return parseSearchResponse(json);
}

/** Speichert Werbetreibende und Anzeigen (Tabellen advertisers und ads). Gibt false zurück, wenn das Speichern scheitert. */
export async function saveAds(supabase: SupabaseClient, ads: MetaAd[]): Promise<boolean> {
  return (await saveAdsWithIds(supabase, ads)) !== null;
}

/**
 * Wie saveAds, gibt aber die interne ID je Meta-Anzeigen-ID zurück (null bei Fehler).
 * first_seen_at bleibt beim ersten Speichern stehen, weil es beim Upsert nicht mitgeschickt wird.
 */
export async function saveAdsWithIds(supabase: SupabaseClient, ads: MetaAd[]): Promise<Map<string, string> | null> {
  if (!ads.length) return new Map();
  const pages = new Map<string, string>();
  for (const ad of ads) if (ad.pageId) pages.set(ad.pageId, ad.pageName ?? "Unbekannte Seite");

  const advertiserIds = new Map<string, string>();
  if (pages.size) {
    const { data, error } = await supabase
      .from("advertisers")
      .upsert(
        [...pages].map(([external_id, name]) => ({ platform: "meta", external_id, name })),
        { onConflict: "platform,external_id" },
      )
      .select("id, external_id");
    if (error) return null;
    for (const row of data ?? []) advertiserIds.set(row.external_id, row.id);
  }

  const now = new Date().toISOString();
  const rows = ads.map((ad) => ({
    platform: "meta",
    external_id: ad.id,
    advertiser_id: ad.pageId ? (advertiserIds.get(ad.pageId) ?? null) : null,
    body: ad.bodies[0] ?? null,
    title: ad.linkTitles[0] ?? null,
    snapshot_url: ad.libraryUrl,
    publisher_platforms: ad.platforms,
    started_at: ad.startedAt,
    stopped_at: ad.stoppedAt,
    eu_reach: ad.euReach,
    fetched_at: now,
    domain: adDomain(ad),
  }));
  const upsert = (list: Record<string, unknown>[]) =>
    supabase.from("ads").upsert(list, { onConflict: "platform,external_id" }).select("id, external_id");
  let { data: saved, error } = await upsert(rows);
  // Ohne Migration 0007 gibt es die Spalte domain noch nicht: dann ohne Domain speichern.
  if (error && /domain/i.test(error.message ?? "")) {
    ({ data: saved, error } = await upsert(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "domain")))));
  }
  if (error) return null;
  return new Map((saved ?? []).map((row: { id: string; external_id: string }) => [row.external_id, row.id]));
}

/** Merkt sich, dass diese Anzeigen heute im Land aktiv waren (Grundlage der eigenen Rangliste). */
export async function recordSightings(supabase: SupabaseClient, adIds: Iterable<string>, country: string, day: string) {
  const rows = [...new Set(adIds)].map((ad_id) => ({ ad_id, day, country }));
  if (!rows.length) return true;
  const { error } = await supabase.from("ad_sightings").upsert(rows, { onConflict: "ad_id,day,country", ignoreDuplicates: true });
  return !error;
}

/** Sucht Anzeigen live bei Meta und speichert die Treffer. Die API ist kostenlos, hat aber ein Abfragelimit pro Stunde. */
/** Übersetzt beliebige Fehler beim Abruf in eine verständliche Meldung. */
export function metaErrorMessage(e: unknown) {
  return e instanceof MetaAdError
    ? e.message
    : e instanceof Error && e.name === "TimeoutError"
      ? "Meta hat nicht rechtzeitig geantwortet."
      : "Meta ist nicht erreichbar.";
}

export async function searchAds(supabase: SupabaseClient, query: AdQuery, fetchImpl?: FetchFn): Promise<AdLookup> {
  const env = getMetaEnv();
  if (!env) return { status: "not_configured" };
  try {
    const result = await fetchAdsLive(query, env, fetchImpl);
    const ids = await saveAdsWithIds(supabase, result.ads);
    const saved = ids !== null;
    // Aktive Treffer zählen für die eigene Rangliste („jetzt aktiv“). Fehlt die Tabelle (Migration 0004), bleibt die Suche nutzbar.
    if (ids && query.status === "ACTIVE") await recordSightings(supabase, ids.values(), query.country, zurichDay());
    await supabase.from("sources").update({ last_success_at: new Date().toISOString() }).eq("id", META_SOURCE_ID);
    return { status: "ok", result, fetchedAt: new Date().toISOString(), saved };
  } catch (e) {
    const message = metaErrorMessage(e);
    await supabase
      .from("sources")
      .update({ last_error_at: new Date().toISOString(), last_error: message.slice(0, 500) })
      .eq("id", META_SOURCE_ID);
    return { status: "error", message };
  }
}
