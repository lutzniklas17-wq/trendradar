/**
 * CJdropshipping API 2.0 (offiziell, kostenlos mit CJ-Konto).
 * Doku: https://developers.cjdropshipping.com/en/api/api2/api/product.html (Produktliste V2)
 * und https://developers.cjdropshipping.com/en/api/api2/api/auth.html (Token).
 * Grenzen laut Doku: 1 Anfrage pro Sekunde, kostenlose Konten max. 1000 Anfragen pro Tag.
 */

export const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";
export const CJ_SOURCE_ID = "cj_dropshipping";
/** Mindestabstand zwischen zwei Anfragen (QPS = 1 laut Doku, mit etwas Reserve). */
export const CJ_MIN_INTERVAL_MS = 1100;
export const CJ_PAGE_SIZE = 50;

/** Sortierung der Produktliste V2 (`orderBy`). */
export const CJ_ORDER = { match: 0, listed: 1, price: 2, newest: 3 } as const;
/** Vorauswahl von CJ (`productFlag`): 0 = Trend, 1 = neu. */
export const CJ_FLAG = { trending: 0, new: 1 } as const;

export type CjQuery = {
  keyword?: string;
  page?: number;
  size?: number;
  orderBy?: (typeof CJ_ORDER)[keyof typeof CJ_ORDER];
  flag?: (typeof CJ_FLAG)[keyof typeof CJ_FLAG];
  /** Nur Produkte mit Lager in diesem Land (z. B. „DE“, „US“). */
  countryCode?: string;
  maxPrice?: number;
};

export type CjProduct = {
  externalId: string;
  sku: string | null;
  title: string;
  imageUrl: string | null;
  price: number | null;
  category: string | null;
  categoryPath: string | null;
  listedCount: number | null;
  inventory: number | null;
  freeShipping: boolean | null;
  hasVideo: boolean | null;
  supplierName: string | null;
  listedAt: string | null;
  productUrl: string;
};

export type CjPage = { products: CjProduct[]; total: number; page: number; totalPages: number };

export class CjError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "limit" | "request" | "network",
  ) {
    super(message);
    this.name = "CjError";
  }
}

export function buildListUrl(q: CjQuery) {
  const url = new URL(`${CJ_BASE}/product/listV2`);
  url.searchParams.set("page", String(Math.min(Math.max(q.page ?? 1, 1), 1000)));
  url.searchParams.set("size", String(Math.min(Math.max(q.size ?? CJ_PAGE_SIZE, 1), 100)));
  const keyword = q.keyword?.trim().slice(0, 200);
  if (keyword) url.searchParams.set("keyWord", keyword);
  if (q.orderBy !== undefined) {
    url.searchParams.set("orderBy", String(q.orderBy));
    url.searchParams.set("sort", q.orderBy === CJ_ORDER.price ? "asc" : "desc");
  }
  if (q.flag !== undefined) url.searchParams.set("productFlag", String(q.flag));
  if (q.countryCode && /^[A-Z]{2}$/.test(q.countryCode)) url.searchParams.set("countryCode", q.countryCode);
  if (q.maxPrice && q.maxPrice > 0) url.searchParams.set("endSellPrice", String(q.maxPrice));
  return url;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
function num(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    // Preise kommen teils als Spanne („2.10 -- 3.40“): der tiefste Wert zählt.
    const n = Number.parseFloat(v.replace(/,/g, "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
/** Ganze Zahl im Bereich einer Postgres-integer-Spalte, sonst null. */
function toInt(v: number | null) {
  if (v === null || !Number.isFinite(v) || v < 0) return null;
  return Math.min(Math.round(v), 2_147_483_647);
}
const bool = (v: unknown) => (typeof v === "boolean" ? v : v === 1 || v === "1" ? true : v === 0 || v === "0" ? false : null);

/** Öffentliche Produktsuche bei CJ (keine bestätigte Detail-URL in der Doku, darum Suche nach SKU oder Titel). */
export function cjProductUrl(sku: string | null, title: string) {
  return `https://cjdropshipping.com/search/${encodeURIComponent((sku || title).slice(0, 80))}.html`;
}

function httpsImage(v: unknown) {
  const s = str(v);
  if (!s) return null;
  const url = s.startsWith("//") ? `https:${s}` : s;
  return /^https:\/\//.test(url) ? url : null;
}

export function toProduct(raw: Record<string, unknown>): CjProduct | null {
  const externalId = str(raw.id) ?? str(raw.pid);
  const title = str(raw.nameEn) ?? str(raw.productNameEn);
  if (!externalId || !title) return null;
  const sku = str(raw.sku) ?? str(raw.spu) ?? str(raw.productSku);
  const path = [str(raw.oneCategoryName), str(raw.twoCategoryName), str(raw.threeCategoryName)].filter(Boolean) as string[];
  const createdMs = num(raw.createAt);
  const inventory = toInt(num(raw.warehouseInventoryNum));
  const listed = toInt(num(raw.listedNum));
  const created = createdMs && createdMs > 1e11 && createdMs < 8.64e15 ? new Date(createdMs) : null;
  return {
    externalId,
    sku,
    title: title.slice(0, 300),
    imageUrl: httpsImage(raw.bigImage ?? raw.productImage),
    price: num(raw.nowPrice) ?? num(raw.sellPrice),
    category: path.at(-1) ?? str(raw.categoryName),
    categoryPath: path.length ? path.join(" / ") : str(raw.categoryName),
    listedCount: listed,
    inventory,
    freeShipping: bool(raw.addMarkStatus),
    hasVideo: bool(raw.isVideo),
    supplierName: str(raw.supplierName),
    listedAt: created && !Number.isNaN(created.getTime()) ? created.toISOString() : null,
    productUrl: cjProductUrl(sku, title),
  };
}

/** Liest die Antwort der Produktliste V2 (`data.content[].productList[]`). */
export function parseListResponse(body: unknown): CjPage {
  const b = (body ?? {}) as { code?: number; result?: boolean; message?: string; data?: Record<string, unknown> | null };
  if (b.result === false || (typeof b.code === "number" && b.code !== 200)) throw cjFailure(b.code, b.message);
  const data = b.data ?? {};
  const content = Array.isArray(data.content) ? (data.content as Record<string, unknown>[]) : [];
  const raw = content.flatMap((c) => (Array.isArray(c.productList) ? (c.productList as Record<string, unknown>[]) : []));
  const seen = new Set<string>();
  const products: CjProduct[] = [];
  for (const r of raw) {
    const p = toProduct(r);
    if (p && !seen.has(p.externalId)) {
      seen.add(p.externalId);
      products.push(p);
    }
  }
  return {
    products,
    total: Number(data.totalRecords) || products.length,
    page: Number(data.pageNumber) || 1,
    totalPages: Number(data.totalPages) || 1,
  };
}

export function cjFailure(code: unknown, message: unknown) {
  const msg = typeof message === "string" ? message : "";
  if (code === 1600001 || code === 1601000 || code === 1600003 || /auth|token/i.test(msg))
    return new CjError("CJ hat den Zugang abgelehnt. Ist CJ_API_KEY richtig gesetzt?", "auth");
  if (code === 429 || /limit|too many|frequen/i.test(msg)) return new CjError("CJ-Abfragelimit erreicht. Bitte später erneut versuchen.", "limit");
  return new CjError(`CJ meldet einen Fehler${msg ? `: ${msg.slice(0, 160)}` : "."}`, "request");
}

export function parseTokenResponse(body: unknown) {
  const b = (body ?? {}) as { code?: number; result?: boolean; message?: string; data?: { accessToken?: unknown; accessTokenExpiryDate?: unknown } | null };
  const token = typeof b.data?.accessToken === "string" ? b.data.accessToken : null;
  if (!token || b.result === false) throw cjFailure(b.code ?? 1600001, b.message);
  const exp = typeof b.data?.accessTokenExpiryDate === "string" ? new Date(b.data.accessTokenExpiryDate) : null;
  return { token, expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp.toISOString() : null };
}
