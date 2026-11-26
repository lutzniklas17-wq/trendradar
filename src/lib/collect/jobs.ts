import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaEnv, getProductHuntEnv } from "@/lib/env";
import { buildSearchUrl, EU_COUNTRIES, META_SOURCE_ID, PAGE_ADS_LIMIT, type AdCountry, type MetaAd } from "@/lib/ads/meta";
import { fetchArchive, metaErrorMessage, recordSightings, saveAdsWithIds } from "@/lib/ads/service";
import { zurichDay } from "@/lib/shops/shops";
import { saveDiscoveries, type ItemArea, type SaveStats } from "@/lib/collect/discoveries";
import { fetchRecentPosts, isEcommerceRelevant, PH_SOURCE_ID, ProductHuntError, toDiscovery as phDiscovery } from "@/lib/collect/producthunt";
import { fetchFeed, matchesKeywords, parseFeed, RSS_SOURCE_ID, toDiscovery as rssDiscovery } from "@/lib/collect/rss";

type FetchFn = typeof fetch;

export const JOBS = ["ads", "producthunt", "rss"] as const;
export type Job = (typeof JOBS)[number];
export const isJob = (v: unknown): v is Job => typeof v === "string" && (JOBS as readonly string[]).includes(v);

export type JobResult = { job: Job; status: "success" | "partial" | "failed" | "skipped"; message: string; newItems: number; details?: unknown };

/** Höchstens so viele Abfrageseiten (je 100 Anzeigen) pro Stichwort und Tag. */
export const MAX_PAGES_PER_TERM = 3;

/** Schreibt einen Lauf ins Protokoll (research_runs). Fehler beim Protokollieren stoppen den Lauf nicht. */
async function logRun(supabase: SupabaseClient, started: Date, r: JobResult) {
  await supabase.from("research_runs").insert({
    job: r.job,
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    status: r.status === "skipped" ? "partial" : r.status,
    new_items: r.newItems,
    log: { message: r.message, details: r.details ?? null },
  });
}

const markSource = (supabase: SupabaseClient, id: string, error: string | null) =>
  supabase
    .from("sources")
    .update(error ? { last_error_at: new Date().toISOString(), last_error: error.slice(0, 500) } : { last_success_at: new Date().toISOString() })
    .eq("id", id);

type Term = { id: string; term: string; country: string };

/** Sammelt die aktiven Anzeigen eines Stichworts in einem Land und merkt sich Sichtung und Stichwort. */
export async function sweepTerm(
  supabase: SupabaseClient,
  term: Term,
  creds: { accessToken: string; graphVersion?: string },
  fetchImpl?: FetchFn,
  now = new Date(),
) {
  const country = (EU_COUNTRIES as readonly string[]).includes(term.country) ? term.country : "DE";
  const ads: MetaAd[] = [];
  let after: string | undefined;
  let capped = true;
  for (let page = 0; page < MAX_PAGES_PER_TERM; page++) {
    const url = buildSearchUrl(
      { terms: term.term, country: country as AdCountry, status: "ACTIVE", platform: "", searchType: "KEYWORD_UNORDERED", after },
      creds.graphVersion,
    );
    url.searchParams.set("limit", String(PAGE_ADS_LIMIT));
    const res = await fetchArchive(url, creds.accessToken, fetchImpl);
    ads.push(...res.ads);
    if (!res.nextCursor) {
      capped = false;
      break;
    }
    after = res.nextCursor;
  }
  const ids = await saveAdsWithIds(supabase, ads);
  if (!ids) throw new Error("Anzeigen konnten nicht gespeichert werden.");
  await recordSightings(supabase, ids.values(), country, zurichDay(now));
  const hits = [...new Set(ids.values())].map((ad_id) => ({ ad_id, term_id: term.id }));
  if (hits.length) await supabase.from("ad_term_hits").upsert(hits, { onConflict: "ad_id,term_id", ignoreDuplicates: true });
  return { count: ads.length, capped };
}

/**
 * Täglicher Anzeigen-Sammellauf über die Stichwortliste. Stichwörter, die heute noch nicht dran waren,
 * kommen zuerst. Bricht vor Ablauf der Zeit oder bei Abfragelimit/Token-Fehler ab; der Rest folgt morgen.
 */
export async function runAdSweep(
  supabase: SupabaseClient,
  { max = 25, deadlineMs = 240_000, fetchImpl, now = new Date() }: { max?: number; deadlineMs?: number; fetchImpl?: FetchFn; now?: Date } = {},
): Promise<JobResult> {
  const started = new Date();
  const env = getMetaEnv();
  if (!env) return { job: "ads", status: "skipped", message: "META_ACCESS_TOKEN fehlt.", newItems: 0 };

  const { data, error } = await supabase
    .from("ad_watch_terms")
    .select("id, term, country, last_run_at")
    .eq("active", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) {
    const r: JobResult = { job: "ads", status: "failed", message: "Stichwörter konnten nicht geladen werden (Migration 0004?).", newItems: 0 };
    await logRun(supabase, started, r);
    return r;
  }
  const today = zurichDay(now);
  const due = (data ?? []).filter((t) => !t.last_run_at || zurichDay(new Date(t.last_run_at)) < today);

  let done = 0;
  let failed = 0;
  let ads = 0;
  let stopReason: string | null = null;
  for (const term of due.slice(0, max)) {
    if (Date.now() - started.getTime() > deadlineMs) {
      stopReason = "Zeitlimit erreicht";
      break;
    }
    try {
      const res = await sweepTerm(supabase, term, env, fetchImpl, now);
      ads += res.count;
      done++;
      await supabase
        .from("ad_watch_terms")
        .update({ last_run_at: now.toISOString(), last_count: res.count, last_error: null })
        .eq("id", term.id);
    } catch (e) {
      failed++;
      const message = e instanceof Error && e.message.startsWith("Anzeigen konnten") ? e.message : metaErrorMessage(e);
      await supabase.from("ad_watch_terms").update({ last_run_at: now.toISOString(), last_error: message.slice(0, 500) }).eq("id", term.id);
      if (/Abfragelimit|Token|Berechtigung/.test(message)) {
        stopReason = message;
        break;
      }
    }
  }
  const remaining = Math.max(0, due.length - done - failed);
  await markSource(supabase, META_SOURCE_ID, stopReason && failed ? stopReason : null);
  const r: JobResult = {
    job: "ads",
    status: failed === 0 && remaining === 0 ? "success" : done > 0 ? "partial" : due.length === 0 ? "success" : "failed",
    message:
      `${done} Stichwörter abgefragt, ${ads} aktive Anzeigen gesehen` +
      (failed ? `, ${failed} mit Fehler` : "") +
      (remaining ? `, ${remaining} offen` : "") +
      (stopReason ? ` (${stopReason})` : "") +
      ".",
    newItems: 0,
    details: { done, failed, remaining, ads },
  };
  await logRun(supabase, started, r);
  return r;
}

/** Täglicher Product-Hunt-Lauf: Launches der letzten 36 Stunden, nur E-Commerce-relevante. */
export async function runProductHunt(supabase: SupabaseClient, { fetchImpl, now = new Date() }: { fetchImpl?: FetchFn; now?: Date } = {}): Promise<JobResult> {
  const started = new Date();
  const env = getProductHuntEnv();
  if (!env) return { job: "producthunt", status: "skipped", message: "PRODUCTHUNT_TOKEN fehlt.", newItems: 0 };
  try {
    const posts = await fetchRecentPosts(env.token, new Date(now.getTime() - 36 * 3_600_000), fetchImpl);
    const relevant = posts.filter(isEcommerceRelevant);
    const stats = await saveDiscoveries(supabase, relevant.map(phDiscovery), now);
    await markSource(supabase, PH_SOURCE_ID, null);
    const r: JobResult = {
      job: "producthunt",
      status: stats.failed ? "partial" : "success",
      message: `${posts.length} Launches gelesen, ${relevant.length} E-Commerce-relevant, ${stats.inserted} neu, ${stats.updated} schon bekannt.`,
      newItems: stats.inserted,
      details: stats,
    };
    await logRun(supabase, started, r);
    return r;
  } catch (e) {
    const message = e instanceof ProductHuntError ? e.message : "Product Hunt ist nicht erreichbar.";
    await markSource(supabase, PH_SOURCE_ID, message);
    const r: JobResult = { job: "producthunt", status: "failed", message, newItems: 0 };
    await logRun(supabase, started, r);
    return r;
  }
}

/** Täglicher Feed-Lauf: liest alle aktiven Feeds, filtert nach Stichwörtern und speichert neue Einträge. */
export async function runFeeds(supabase: SupabaseClient, { fetchImpl, now = new Date() }: { fetchImpl?: FetchFn; now?: Date } = {}): Promise<JobResult> {
  const started = new Date();
  const { data: feeds, error } = await supabase.from("feeds").select("id, url, name, area, keywords").eq("active", true).limit(50);
  if (error) {
    const r: JobResult = { job: "rss", status: "failed", message: "Feeds konnten nicht geladen werden (Migration 0004?).", newItems: 0 };
    await logRun(supabase, started, r);
    return r;
  }
  if (!feeds?.length) return { job: "rss", status: "skipped", message: "Keine Feeds eingetragen.", newItems: 0 };

  const total: SaveStats = { inserted: 0, updated: 0, failed: 0 };
  let feedErrors = 0;
  for (const feed of feeds as { id: string; url: string; name: string; area: ItemArea; keywords: string[] }[]) {
    try {
      const entries = parseFeed(await fetchFeed(feed.url, fetchImpl)).filter((e) => matchesKeywords(e, feed.keywords ?? []));
      const stats = await saveDiscoveries(supabase, entries.map((e) => rssDiscovery(e, feed)), now);
      total.inserted += stats.inserted;
      total.updated += stats.updated;
      total.failed += stats.failed;
      await supabase.from("feeds").update({ last_run_at: now.toISOString(), last_count: entries.length, last_error: null }).eq("id", feed.id);
    } catch (e) {
      feedErrors++;
      const message = e instanceof Error && e.name !== "TimeoutError" ? e.message : "Feed hat nicht rechtzeitig geantwortet.";
      await supabase.from("feeds").update({ last_run_at: now.toISOString(), last_error: message.slice(0, 300) }).eq("id", feed.id);
    }
  }
  await markSource(supabase, RSS_SOURCE_ID, feedErrors === feeds.length ? "Alle Feeds fehlgeschlagen." : null);
  const r: JobResult = {
    job: "rss",
    status: feedErrors === feeds.length ? "failed" : feedErrors || total.failed ? "partial" : "success",
    message: `${feeds.length} Feeds gelesen, ${total.inserted} neue Einträge, ${total.updated} schon bekannt` + (feedErrors ? `, ${feedErrors} Feeds mit Fehler.` : "."),
    newItems: total.inserted,
    details: { ...total, feedErrors },
  };
  await logRun(supabase, started, r);
  return r;
}

export function runJob(supabase: SupabaseClient, job: Job, opts: { fetchImpl?: FetchFn; max?: number } = {}) {
  if (job === "ads") return runAdSweep(supabase, opts);
  if (job === "producthunt") return runProductHunt(supabase, opts);
  return runFeeds(supabase, opts);
}
