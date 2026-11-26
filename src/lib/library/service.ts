import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCjEnv } from "@/lib/env";
import { zurichDay } from "@/lib/shops/shops";
import {
  buildListUrl,
  CJ_BASE,
  CJ_MIN_INTERVAL_MS,
  CjError,
  parseListResponse,
  parseTokenResponse,
  type CjPage,
  type CjProduct,
  type CjQuery,
} from "@/lib/library/cj";
import { classifyProduct } from "@/lib/library/relevance";

type FetchFn = typeof fetch;
type Env = NonNullable<ReturnType<typeof getCjEnv>>;

let lastCall = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hält das Limit von 1 Anfrage pro Sekunde ein (pro Server-Instanz). */
async function throttle() {
  const gap = Date.now() - lastCall;
  if (gap < CJ_MIN_INTERVAL_MS) await wait(CJ_MIN_INTERVAL_MS - gap);
  lastCall = Date.now();
}

/** Zählt eine CJ-Anfrage und prüft vorher das Tageslimit. */
async function takeQuota(supabase: SupabaseClient, env: Env, now: Date) {
  const day = zurichDay(now);
  const { data } = await supabase.from("api_usage").select("calls").eq("provider", "cj").eq("day", day).maybeSingle();
  if ((data?.calls ?? 0) >= env.dailyLimit) throw new CjError(`Tageslimit von ${env.dailyLimit} CJ-Abfragen erreicht. Morgen geht es weiter.`, "limit");
  await supabase.rpc("bump_api_usage", { p_provider: "cj", p_day: day, p_calls: 1 });
}

async function request(url: string, init: RequestInit, fetchImpl: FetchFn) {
  await throttle();
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
  await takeQuota(supabase, env, now);
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
    await takeQuota(supabase, env, now);
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
export async function saveProducts(supabase: SupabaseClient, products: CjProduct[], term: string | null, now = new Date()) {
  if (!products.length) return { saved: 0, added: 0 };
  const ids = products.map((p) => p.externalId);
  const { data: known } = await supabase.from("supplier_products").select("external_id, search_terms").eq("platform", "cj").in("external_id", ids);
  const termsById = new Map(((known ?? []) as { external_id: string; search_terms: string[] }[]).map((k) => [k.external_id, k.search_terms ?? []]));
  const t = term?.trim().toLowerCase().slice(0, 80) || null;

  const rows = products.map((p) => {
    const { relevance, reason } = classifyProduct(p);
    const terms = new Set(termsById.get(p.externalId) ?? []);
    if (t) terms.add(t);
    return {
      platform: "cj",
      external_id: p.externalId,
      sku: p.sku,
      title: p.title,
      image_url: p.imageUrl,
      price: p.price,
      currency: "USD",
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
  if (error || !saved) throw new Error("Produkte konnten nicht gespeichert werden. Ist die Migration 0008 gelaufen?");
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
