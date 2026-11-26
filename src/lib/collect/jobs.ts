import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaEnv, getProductHuntEnv } from "@/lib/env";
import { buildSearchUrl, EU_COUNTRIES, META_SOURCE_ID, PAGE_ADS_LIMIT, type AdCountry, type MetaAd } from "@/lib/ads/meta";
import { fetchArchive, metaErrorMessage, recordSightings, saveAdsWithIds } from "@/lib/ads/service";
import { zurichDay } from "@/lib/shops/shops";
import { saveDiscoveries, type ItemArea, type SaveStats } from "@/lib/collect/discoveries";
import { fetchRecentPosts, isEcommerceRelevant, PH_SOURCE_ID, ProductHuntError, toDiscovery as phDiscovery } from "@/lib/collect/producthunt";
import { fetchFeed, matchesKeywords, parseFeed, RSS_SOURCE_ID, toDiscovery as rssDiscovery } from "@/lib/collect/rss";
import { addInboxEntry, type Change } from "@/lib/inbox";

type FetchFn = typeof fetch;

export const JOBS = ["ads", "producthunt", "rss", "news"] as const;
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

type Term = { id: string; term: string; country: string; last_run_at?: string | null };

const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Welche der Werte existieren schon in einer Spalte? (in Blöcken, damit die URL kurz bleibt) */
async function existing(supabase: SupabaseClient, table: string, column: string, values: string[], filters: Record<string, string> = {}) {
  const found = new Set<string>();
  for (const part of chunks([...new Set(values)], 150)) {
    let q = supabase.from(table).select(column).in(column, part);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data } = await q;
    for (const row of (data ?? []) as unknown as Record<string, string>[]) found.add(row[column]);
  }
  return found;
}

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
  // Was ist neu? (vor dem Speichern prüfen)
  const knownAds = await existing(supabase, "ads", "external_id", ads.map((a) => a.id));
  const knownPages = await existing(supabase, "advertisers", "external_id", ads.map((a) => a.pageId).filter((x): x is string => !!x));
  const newAds = new Set(ads.filter((a) => !knownAds.has(a.id)).map((a) => a.id)).size;
  const newAdvertisers = [
    ...new Map(ads.filter((a) => a.pageId && !knownPages.has(a.pageId)).map((a) => [a.pageId, a.pageName ?? "Unbekannte Seite"])).values(),
  ];

  const ids = await saveAdsWithIds(supabase, ads);
  if (!ids) throw new Error("Anzeigen konnten nicht gespeichert werden.");
  const today = zurichDay(now);
  await recordSightings(supabase, ids.values(), country, today);
  const hits = [...new Set(ids.values())].map((ad_id) => ({ ad_id, term_id: term.id }));
  if (hits.length) await supabase.from("ad_term_hits").upsert(hits, { onConflict: "ad_id,term_id", ignoreDuplicates: true });

  // Nicht mehr aktiv: beim letzten Lauf gesehen, heute nicht. Nur sicher, wenn heute alle Treffer geladen wurden.
  let ended: number | null = null;
  const prevDay = term.last_run_at ? zurichDay(new Date(term.last_run_at)) : null;
  if (!capped && prevDay && prevDay < today) {
    const { data: termHits } = await supabase.from("ad_term_hits").select("ad_id").eq("term_id", term.id).limit(2000);
    const todayIds = new Set(ids.values());
    const candidates = ((termHits ?? []) as { ad_id: string }[]).map((h) => h.ad_id).filter((id) => !todayIds.has(id));
    const seenBefore = await existing(supabase, "ad_sightings", "ad_id", candidates, { day: prevDay, country });
    ended = seenBefore.size;
  }
  return { count: ads.length, capped, newAds, newAdvertisers, ended, firstRun: !term.last_run_at };
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
  const changes: Change[] = [];
  for (const term of due.slice(0, max)) {
    if (Date.now() - started.getTime() > deadlineMs) {
      stopReason = "Zeitlimit erreicht";
      break;
    }
    try {
      const res = await sweepTerm(supabase, term, env, fetchImpl, now);
      ads += res.count;
      done++;
      const label = `${term.term} (${term.country})`;
      const href = `/ad-spy/rangliste?stichwort=${term.id}`;
      if (res.firstRun) {
        changes.push({ kind: "added", label, detail: `erstmals gesammelt: ${res.count}${res.capped ? "+" : ""} aktive Anzeigen`, href });
      } else if (res.newAds || res.ended) {
        const parts = [
          res.newAds ? `${res.newAds} neue Anzeigen` : null,
          res.newAdvertisers.length ? `neue Werbetreibende: ${res.newAdvertisers.slice(0, 5).join(", ")}${res.newAdvertisers.length > 5 ? " …" : ""}` : null,
          res.ended ? `${res.ended} nicht mehr aktiv` : null,
        ].filter(Boolean);
        changes.push({ kind: "changed", label, detail: parts.join(" · "), href });
      }
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
  await addInboxEntry(supabase, "ads", "Anzeigen-Sammellauf", changes);
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
      details: { inserted: stats.inserted, updated: stats.updated, failed: stats.failed },
    };
    await logRun(supabase, started, r);
    await addInboxEntry(
      supabase,
      "producthunt",
      "Neue Launches auf Product Hunt",
      stats.added.map((a) => ({ kind: "added" as const, label: a.name, href: `/produkt/${a.id}` })),
    );
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
  const { data: allFeeds, error } = await supabase.from("feeds").select("*").eq("active", true).limit(100);
  // Ohne Migration 0006 gibt es die Spalte kind noch nicht: dann sind alle Feeds Entdeckungs-Feeds.
  const feeds = ((allFeeds ?? []) as { kind?: string }[]).filter((f) => (f.kind ?? "discoveries") === "discoveries");
  if (error) {
    const r: JobResult = { job: "rss", status: "failed", message: "Feeds konnten nicht geladen werden (Migration 0004?).", newItems: 0 };
    await logRun(supabase, started, r);
    return r;
  }
  if (!feeds.length) return { job: "rss", status: "skipped", message: "Keine Feeds eingetragen.", newItems: 0 };

  const total: SaveStats = { inserted: 0, updated: 0, failed: 0, added: [] };
  let feedErrors = 0;
  for (const feed of feeds as { id: string; url: string; name: string; area: ItemArea; keywords: string[] }[]) {
    try {
      const entries = parseFeed(await fetchFeed(feed.url, fetchImpl)).filter((e) => matchesKeywords(e, feed.keywords ?? []));
      const stats = await saveDiscoveries(supabase, entries.map((e) => rssDiscovery(e, feed)), now);
      total.inserted += stats.inserted;
      total.updated += stats.updated;
      total.failed += stats.failed;
      total.added.push(...stats.added);
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
    details: { inserted: total.inserted, updated: total.updated, failed: total.failed, feedErrors },
  };
  await logRun(supabase, started, r);
  await addInboxEntry(supabase, "rss", "Neue Einträge aus RSS-Feeds", total.added.map((a) => ({ kind: "added" as const, label: a.name, href: `/produkt/${a.id}` })));
  return r;
}

/** Alte News (älter als NEWS_KEEP_DAYS) werden gelöscht, damit die Datenbank klein bleibt. */
export const NEWS_KEEP_DAYS = 30;

/** Täglicher News-Lauf: liest alle News-Feeds und speichert Titel, Bild, Anrisstext und Link (keine Volltexte). */
export async function runNews(supabase: SupabaseClient, { fetchImpl, now = new Date() }: { fetchImpl?: FetchFn; now?: Date } = {}): Promise<JobResult> {
  const started = new Date();
  const { data, error } = await supabase.from("feeds").select("*").eq("active", true).eq("kind", "news").limit(50);
  if (error) {
    const r: JobResult = { job: "news", status: "failed", message: "News-Feeds konnten nicht geladen werden (Migration 0006?).", newItems: 0 };
    await logRun(supabase, started, r);
    return r;
  }
  const feeds = (data ?? []) as { id: string; url: string; name: string; keywords: string[] | null }[];
  if (!feeds.length) return { job: "news", status: "skipped", message: "Keine News-Feeds eingetragen.", newItems: 0 };

  let added = 0;
  let feedErrors = 0;
  for (const feed of feeds) {
    try {
      const entries = parseFeed(await fetchFeed(feed.url, fetchImpl)).filter((e) => matchesKeywords(e, feed.keywords ?? []));
      const rows = entries.map((e) => ({
        feed_id: feed.id,
        source_name: feed.name,
        title: e.title,
        url: e.link,
        image_url: e.image ?? null,
        excerpt: e.summary ? e.summary.slice(0, 400) : null,
        published_at: e.publishedAt,
        fetched_at: now.toISOString(),
      }));
      if (rows.length) {
        const { data: inserted } = await supabase.from("news_articles").upsert(rows, { onConflict: "url", ignoreDuplicates: true }).select("id");
        added += inserted?.length ?? 0;
      }
      await supabase.from("feeds").update({ last_run_at: now.toISOString(), last_count: entries.length, last_error: null }).eq("id", feed.id);
    } catch (e) {
      feedErrors++;
      const message = e instanceof Error && e.name !== "TimeoutError" ? e.message : "Feed hat nicht rechtzeitig geantwortet.";
      await supabase.from("feeds").update({ last_run_at: now.toISOString(), last_error: message.slice(0, 300) }).eq("id", feed.id);
    }
  }
  await supabase.from("news_articles").delete().lt("fetched_at", new Date(now.getTime() - NEWS_KEEP_DAYS * 86_400_000).toISOString());
  const r: JobResult = {
    job: "news",
    status: feedErrors === feeds.length ? "failed" : feedErrors ? "partial" : "success",
    message: `${feeds.length} News-Feeds gelesen, ${added} neue Artikel` + (feedErrors ? `, ${feedErrors} Feeds mit Fehler.` : "."),
    newItems: added,
    details: { added, feedErrors },
  };
  await logRun(supabase, started, r);
  return r;
}

export function runJob(supabase: SupabaseClient, job: Job, opts: { fetchImpl?: FetchFn; max?: number } = {}) {
  if (job === "ads") return runAdSweep(supabase, opts);
  if (job === "producthunt") return runProductHunt(supabase, opts);
  if (job === "news") return runNews(supabase, opts);
  return runFeeds(supabase, opts);
}
