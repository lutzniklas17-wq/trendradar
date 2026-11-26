import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataForSeoEnv } from "@/lib/env";
import {
  buildExploreTask,
  DATAFORSEO_EXPLORE_URL,
  DataForSeoError,
  parseExploreResponse,
  toPgArrayLiteral,
  TRENDS_SOURCE_ID,
  type TrendQuery,
  type TrendResult,
} from "@/lib/trends/dataforseo";

/** Gespeicherte Antworten gelten 24 Stunden; danach wird neu abgefragt. */
export const CACHE_HOURS = 24;

export type TrendLookup =
  | { status: "ok"; result: TrendResult; fetchedAt: string; fromCache: boolean }
  | { status: "not_configured" }
  | { status: "limit_reached"; limit: number }
  | { status: "error"; message: string };

type FetchFn = typeof fetch;

/** Ruft DataForSEO direkt ab (kostet Geld). Nur über getTrend aufrufen, damit Zwischenspeicher und Tageslimit greifen. */
export async function fetchExploreLive(
  query: TrendQuery,
  creds: { login: string; password: string },
  fetchImpl: FetchFn = fetch,
): Promise<TrendResult> {
  const auth = Buffer.from(`${creds.login}:${creds.password}`).toString("base64");
  const res = await fetchImpl(DATAFORSEO_EXPLORE_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildExploreTask(query)),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (res.status === 401) throw new DataForSeoError("Login oder Passwort von DataForSEO ist falsch.", 401);
  if (!res.ok) throw new DataForSeoError(`DataForSEO antwortet mit HTTP ${res.status}.`, res.status);
  return parseExploreResponse(await res.json(), query.keywords);
}

/**
 * Holt eine Trendkurve: zuerst aus dem Zwischenspeicher (trend_series), sonst live von DataForSEO.
 * Ein Tageslimit schützt vor unerwarteten Kosten.
 */
export async function getTrend(supabase: SupabaseClient, query: TrendQuery, fetchImpl?: FetchFn): Promise<TrendLookup> {
  const since = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
  const cached = await supabase
    .from("trend_series")
    .select("payload, fetched_at")
    .eq("source_id", TRENDS_SOURCE_ID)
    .eq("geo", query.geo)
    .eq("time_range", query.timeRange)
    .filter("keywords", "eq", toPgArrayLiteral(query.keywords))
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached.error) return { status: "error", message: "Zwischenspeicher nicht lesbar. Ist Migration 0001 ausgeführt?" };
  if (cached.data) {
    return { status: "ok", result: cached.data.payload as TrendResult, fetchedAt: cached.data.fetched_at, fromCache: true };
  }

  const env = getDataForSeoEnv();
  if (!env) return { status: "not_configured" };

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from("trend_series")
    .select("id", { count: "exact", head: true })
    .eq("source_id", TRENDS_SOURCE_ID)
    .gte("fetched_at", startOfDay.toISOString());
  if (countError) return { status: "error", message: "Tageslimit konnte nicht geprüft werden." };
  if ((count ?? 0) >= env.dailyLimit) return { status: "limit_reached", limit: env.dailyLimit };

  try {
    const result = await fetchExploreLive(query, env, fetchImpl);
    const { data, error } = await supabase
      .from("trend_series")
      .insert({ keywords: query.keywords, geo: query.geo, time_range: query.timeRange, source_id: TRENDS_SOURCE_ID, payload: result })
      .select("fetched_at")
      .single();
    await supabase.from("sources").update({ last_success_at: new Date().toISOString() }).eq("id", TRENDS_SOURCE_ID);
    return { status: "ok", result, fetchedAt: error ? new Date().toISOString() : data.fetched_at, fromCache: false };
  } catch (e) {
    const message =
      e instanceof DataForSeoError
        ? e.message
        : e instanceof Error && e.name === "TimeoutError"
          ? "DataForSEO hat nicht rechtzeitig geantwortet."
          : "DataForSEO ist nicht erreichbar.";
    await supabase
      .from("sources")
      .update({ last_error_at: new Date().toISOString(), last_error: message.slice(0, 500) })
      .eq("id", TRENDS_SOURCE_ID);
    return { status: "error", message };
  }
}
