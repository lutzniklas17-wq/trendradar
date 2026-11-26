/**
 * AliExpress Open Platform, Affiliate API (offiziell, kostenlos nach Freigabe auf portals.aliexpress.com
 * und openservice.aliexpress.com). Methode `aliexpress.affiliate.product.query` (Stichwortsuche).
 *
 * Aufruf laut Open-Platform-Regeln: Business-Schnittstellen über `https://api-sg.aliexpress.com/sync`,
 * Methode als Parameter `method`, Signatur HMAC-SHA256 mit dem App Secret über alle Parameter
 * (nach Name sortiert, Name und Wert ohne Trennzeichen aneinandergehängt), Ergebnis als Hex in Grossbuchstaben.
 * Noch nicht mit echten Schlüsseln getestet: Feldnamen werden darum tolerant gelesen.
 */
import { createHmac } from "node:crypto";
import { SupplierError, type SupplierPage, type SupplierProduct } from "@/lib/library/sources";

export const AE_ENDPOINT = "https://api-sg.aliexpress.com/sync";
export const AE_METHOD = "aliexpress.affiliate.product.query";
export const AE_MIN_INTERVAL_MS = 1100;
export const AE_PAGE_SIZE = 50;

/** Sortierungen der Affiliate-Produktsuche. */
export const AE_SORT = { volume: "LAST_VOLUME_DESC", priceAsc: "SALE_PRICE_ASC" } as const;

export type AeQuery = { keyword: string; page?: number; size?: number; sort?: (typeof AE_SORT)[keyof typeof AE_SORT]; shipTo?: string; maxPrice?: number };
export type AeCredentials = { appKey: string; appSecret: string; trackingId: string | null };

export class AeError extends SupplierError {
  constructor(message: string, kind: SupplierError["kind"]) {
    super(message, kind);
    this.name = "AeError";
  }
}

/** Signatur nach den Regeln der AliExpress Open Platform (Business-API, ohne Pfad-Präfix). */
export function signParams(params: Record<string, string>, secret: string) {
  const base = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase();
}

/** Baut die signierten Parameter für eine Suche. */
export function buildSearchParams(q: AeQuery, cred: AeCredentials, now = new Date()) {
  const params: Record<string, string> = {
    app_key: cred.appKey,
    method: AE_METHOD,
    timestamp: String(now.getTime()),
    sign_method: "sha256",
    format: "json",
    v: "2.0",
    keywords: q.keyword.trim().slice(0, 200),
    page_no: String(Math.min(Math.max(q.page ?? 1, 1), 100)),
    page_size: String(Math.min(Math.max(q.size ?? AE_PAGE_SIZE, 1), 50)),
    sort: q.sort ?? AE_SORT.volume,
    target_currency: "USD",
    target_language: "EN",
  };
  if (cred.trackingId) params.tracking_id = cred.trackingId;
  if (q.shipTo && /^[A-Z]{2}$/.test(q.shipTo)) params.ship_to_country = q.shipTo;
  // max_sale_price erwartet laut Affiliate-Doku Cent-Beträge
  if (q.maxPrice && q.maxPrice > 0) params.max_sale_price = String(Math.round(q.maxPrice * 100));
  params.sign = signParams(params, cred.appSecret);
  return new URLSearchParams(params);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
function num(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v.replace(/,/g, "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function toInt(v: number | null) {
  if (v === null || !Number.isFinite(v) || v < 0) return null;
  return Math.min(Math.round(v), 2_147_483_647);
}
function httpsUrl(v: unknown) {
  const s = str(v);
  if (!s) return null;
  const url = s.startsWith("//") ? `https:${s}` : s;
  return /^https:\/\//.test(url) ? url : null;
}

export function toProduct(raw: Record<string, unknown>): SupplierProduct | null {
  const externalId = str(raw.product_id);
  const title = str(raw.product_title);
  if (!externalId || !/^\d+$/.test(externalId) || !title) return null;
  const path = [str(raw.first_level_category_name), str(raw.second_level_category_name)].filter(Boolean) as string[];
  const price = num(raw.target_sale_price) ?? num(raw.sale_price) ?? num(raw.target_app_sale_price);
  const currency = str(raw.target_sale_price_currency) ?? str(raw.sale_price_currency) ?? "USD";
  return {
    externalId,
    sku: null,
    title: title.slice(0, 300),
    imageUrl: httpsUrl(raw.product_main_image_url),
    price,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
    category: path.at(-1) ?? null,
    categoryPath: path.length ? path.join(" / ") : null,
    listedCount: toInt(num(raw.lastest_volume) ?? num(raw.latest_volume)),
    inventory: null,
    freeShipping: null,
    hasVideo: raw.product_video_url ? true : null,
    supplierName: str(raw.shop_name),
    listedAt: null,
    // Öffentliche Produktseite; der Partnerlink (promotion_link) bleibt bewusst weg.
    productUrl: `https://www.aliexpress.com/item/${externalId}.html`,
  };
}

export function aeFailure(code: unknown, message: unknown) {
  const msg = typeof message === "string" ? message : "";
  const c = String(code ?? "");
  if (/IncompleteSignature|InvalidApiPath|AppKey|appkey|Invalid ?Sign|IllegalAccessToken|InsufficientPermission|isv\./i.test(`${c} ${msg}`))
    return new AeError("AliExpress hat den Zugang abgelehnt. Sind ALIEXPRESS_APP_KEY und ALIEXPRESS_APP_SECRET richtig gesetzt und ist die App freigegeben?", "auth");
  if (/ApiCallLimit|limit|frequen|too many/i.test(`${c} ${msg}`)) return new AeError("AliExpress-Abfragelimit erreicht. Bitte später erneut versuchen.", "limit");
  return new AeError(`AliExpress meldet einen Fehler${msg ? `: ${msg.slice(0, 160)}` : c ? ` (${c.slice(0, 40)})` : "."}`, "request");
}

/** Liest die Antwort von `aliexpress.affiliate.product.query`. */
export function parseSearchResponse(body: unknown): SupplierPage {
  const b = (body ?? {}) as Record<string, unknown>;
  const err = b.error_response as { code?: unknown; msg?: unknown; sub_msg?: unknown } | undefined;
  if (err) throw aeFailure(err.code, err.sub_msg ?? err.msg);
  if (typeof b.code === "string" && b.code !== "0" && b.message) throw aeFailure(b.code, b.message);
  const wrap = (b.aliexpress_affiliate_product_query_response ?? {}) as { resp_result?: { resp_code?: unknown; resp_msg?: unknown; result?: Record<string, unknown> } };
  const resp = wrap.resp_result;
  if (!resp) throw new AeError("AliExpress hat keine lesbare Antwort geschickt.", "request");
  const code = Number(resp.resp_code);
  // 405 = keine Treffer (laut Affiliate-Doku)
  if (code === 405) return { products: [], total: 0, page: 1, totalPages: 1 };
  if (Number.isFinite(code) && code !== 200) throw aeFailure(code, resp.resp_msg);
  const result = resp.result ?? {};
  const list = result.products as unknown;
  const raw = (Array.isArray(list) ? list : Array.isArray((list as { product?: unknown })?.product) ? (list as { product: unknown[] }).product : []) as Record<string, unknown>[];
  const seen = new Set<string>();
  const products: SupplierProduct[] = [];
  for (const r of raw) {
    const p = toProduct(r);
    if (p && !seen.has(p.externalId)) {
      seen.add(p.externalId);
      products.push(p);
    }
  }
  return {
    products,
    total: Number(result.total_record_count) || products.length,
    page: Number(result.current_page_no) || 1,
    totalPages: Number(result.total_page_no) || 1,
  };
}
