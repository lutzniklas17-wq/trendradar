import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAliExpressEnv, getCjEnv } from "@/lib/env";
import { zurichDay } from "@/lib/shops/shops";
import {
  buildListUrl,
  CJ_BASE,
  CJ_MIN_INTERVAL_MS,
  CJ_ORDER,
  CjError,
  parseListResponse,
  parseTokenResponse,
  type CjPage,
  type CjQuery,
} from "@/lib/library/cj";
import { AE_ENDPOINT, AE_MIN_INTERVAL_MS, AeError, buildSearchParams, parseSearchResponse, type AeQuery } from "@/lib/library/aliexpress";
import { classifyProduct } from "@/lib/library/relevance";
import { librarySource, type LibraryPlatform, type SupplierPage, type SupplierProduct } from "@/lib/library/sources";

type FetchFn = typeof fetch;
type Env = NonNullable<ReturnType<typeof getCjEnv>>;

const lastCall: Record<string, number> = {};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hält das Limit von 1 Anfrage pro Sekunde je Plattform ein (pro Server-Instanz). */
async function throttle(provider: string, gapMs: number) {
  const gap = Date.now() - (lastCall[provider] ?? 0);
  if (gap < gapMs) await wait(gapMs - gap);
  lastCall[provider] = Date.now();
}

/** Zählt eine Anfrage und prüft vorher das Tageslimit der Plattform. */
async function takeQuota(supabase: SupabaseClient, provider: LibraryPlatform, dailyLimit: number, now: Date) {
  const day = zurichDay(now);
  const { data } = await supabase.from("api_usage").select("calls").eq("provider", provider).eq("day", day).maybeSingle();
  const name = librarySource(provider)?.name ?? provider;
  if ((data?.calls ?? 0) >= dailyLimit) {
    const msg = `Tageslimit von ${dailyLimit} ${name}-Abfragen erreicht. Morgen geht es weiter.`;
    throw provider === "cj" ? new CjError(msg, "limit") : new AeError(msg, "limit");
  }
  await supabase.rpc("bump_api_usage", { p_provider: provider, p_day: day, p_calls: 1 });
}

async function request(url: string, init: RequestInit, fetchImpl: FetchFn) {
  await throttle("cj", CJ_MIN_INTERVAL_MS);
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  } catch {
    throw new CjError("CJ ist gerade nicht erreichbar.", "network");
  }
  if (res.status === 429) throw new CjError("CJ-Abfragelimit erreicht. Bitte später erneut versuchen.", "limit");
  const body = await res.json().catch(() => null);
  if (!body) throw new CjError(`CJ hat keine lesbare Antwort geschickt (HTTP ${res.status}).`, "request");
  return body;
}

/** Holt das Zugangstoken (gilt laut Doku 180 Tage) aus dem Zwischenspeicher oder neu von CJ. */
async function accessToken(supabase: SupabaseClient, env: Env, fetchImpl: FetchFn, now: Date, forceNew = false) {
  if (!forceNew) {
    const { data } = await supabase.from("provider_tokens").select("access_token, expires_at").eq("provider", "cj").maybeSingle();
    if (data?.access_token && (!data.expires_at || Date.parse(data.expires_at) > now.getTime() + 86_400_000)) return data.access_token as string;
  }
  await takeQuota(supabase, "cj", env.dailyLimit, now);
  const body = await request(
    `${CJ_BASE}/authentication/getAccessToken`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: env.apiKey }) },
    fetchImpl,
  );
  const { token, expiresAt } = parseTokenResponse(body);
  await supabase.from("provider_tokens").upsert({ provider: "cj", access_token: token, expires_at: expiresAt, updated_at: now.toISOString() });
  return token;
}

/** Eine Seite der CJ-Produktliste. Wirft CjError mit verständlicher Meldung. */
export async function searchCj(supabase: SupabaseClient, query: CjQuery, fetchImpl: FetchFn = fetch, now = new Date()): Promise<CjPage> {
  const env = getCjEnv();
  if (!env) throw new CjError("CJ_API_KEY fehlt.", "auth");
  const url = buildListUrl(query).toString();
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(supabase, env, fetchImpl, now, attempt > 0);
    await takeQuota(supabase, "cj", env.dailyLimit, now);
    try {
      return parseListResponse(await request(url, { headers: { "CJ-Access-Token": token } }, fetchImpl));
    } catch (e) {
      // Abgelaufenes oder widerrufenes Token: einmal neu holen.
      if (e instanceof CjError && e.kind === "auth" && attempt === 0) continue;
      throw e;
    }
  }
  throw new CjError("CJ hat den Zugang abgelehnt. Ist CJ_API_KEY richtig gesetzt?", "auth");
}

/**
 * Speichert Treffer in der Bibliothek (neu oder aktualisiert) samt Tagesmesspunkt.
 * Ausblenden, Übernahme und KI-Bewertung bleiben erhalten, weil sie nicht mitgeschickt werden.
 */
export async function saveProducts(supabase: SupabaseClient, platform: LibraryPlatform, products: SupplierProduct[], term: string | null, now = new Date()) {
  if (!products.length) return { saved: 0, added: 0 };
  const ids = products.map((p) => p.externalId);
  const { data: known } = await supabase.from("supplier_products").select("external_id, search_terms").eq("platform", platform).in("external_id", ids);
  const termsById = new Map(((known ?? []) as { external_id: string; search_terms: string[] }[]).map((k) => [k.external_id, k.search_terms ?? []]));
  const t = term?.trim().toLowerCase().slice(0, 80) || null;

  const rows = products.map((p) => {
    const { relevance, reason } = classifyProduct(p);
    const terms = new Set(termsById.get(p.externalId) ?? []);
    if (t) terms.add(t);
    return {
      platform,
      external_id: p.externalId,
      sku: p.sku,
      title: p.title,
      image_url: p.imageUrl,
      price: p.price,
      currency: p.currency,
      category: p.category,
      category_path: p.categoryPath,
      listed_count: p.listedCount,
      inventory: p.inventory,
      free_shipping: p.freeShipping,
      has_video: p.hasVideo,
      supplier_name: p.supplierName,
      product_url: p.productUrl,
      listed_at: p.listedAt,
      search_terms: [...terms].slice(0, 20),
      relevance,
      relevance_reason: reason,
      last_seen_at: now.toISOString(),
    };
  });
  const { data: saved, error } = await supabase.from("supplier_products").upsert(rows, { onConflict: "platform,external_id" }).select("id, listed_count, price, inventory");
  if (error || !saved) {
    console.error("supplier_products upsert", error);
    throw new Error(`Produkte konnten nicht gespeichert werden (Datenbank: ${error?.message?.slice(0, 160) ?? "keine Antwort"}).`);
  }
  const day = zurichDay(now);
  const snaps = (saved as { id: string; listed_count: number | null; price: number | null; inventory: number | null }[]).map((s) => ({
    product_id: s.id,
    day,
    listed_count: s.listed_count,
    price: s.price,
    inventory: s.inventory,
  }));
  await supabase.from("supplier_product_snapshots").upsert(snaps, { onConflict: "product_id,day" });
  return { saved: saved.length, added: products.length - termsById.size };
}

/** Eine Seite der AliExpress-Affiliate-Suche. Wirft AeError mit verständlicher Meldung. */
export async function searchAliExpress(supabase: SupabaseClient, query: AeQuery, fetchImpl: FetchFn = fetch, now = new Date()): Promise<SupplierPage> {
  const env = getAliExpressEnv();
  if (!env) throw new AeError("ALIEXPRESS_APP_KEY oder ALIEXPRESS_APP_SECRET fehlt.", "auth");
  await takeQuota(supabase, "aliexpress", env.dailyLimit, now);
  await throttle("aliexpress", AE_MIN_INTERVAL_MS);
  let res: Response;
  try {
    res = await fetchImpl(AE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: buildSearchParams(query, env, new Date()).toString(),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new AeError("AliExpress ist gerade nicht erreichbar.", "network");
  }
  if (res.status === 429) throw new AeError("AliExpress-Abfragelimit erreicht. Bitte später erneut versuchen.", "limit");
  const body = await res.json().catch(() => null);
  if (!body) throw new AeError(`AliExpress hat keine lesbare Antwort geschickt (HTTP ${res.status}).`, "request");
  return parseSearchResponse(body);
}

/** Plattformen, deren Schlüssel gesetzt sind. */
export function connectedPlatforms(): LibraryPlatform[] {
  const out: LibraryPlatform[] = [];
  if (getCjEnv()) out.push("cj");
  if (getAliExpressEnv()) out.push("aliexpress");
  return out;
}

/** `country` = Lagerland, nur CJ kennt diesen Filter. */
export type KeywordSearch = { keyword: string; country?: string; maxPrice?: number };

/** Stichwortsuche bei einer Plattform, sortiert nach Beliebtheit (CJ: Übernahmen, AliExpress: Verkäufe). */
export function searchPlatform(supabase: SupabaseClient, platform: LibraryPlatform, q: KeywordSearch, fetchImpl: FetchFn = fetch): Promise<SupplierPage> {
  if (platform === "aliexpress") return searchAliExpress(supabase, { keyword: q.keyword, maxPrice: q.maxPrice }, fetchImpl);
  return searchCj(supabase, { keyword: q.keyword, orderBy: CJ_ORDER.listed, countryCode: q.country, maxPrice: q.maxPrice }, fetchImpl);
}
