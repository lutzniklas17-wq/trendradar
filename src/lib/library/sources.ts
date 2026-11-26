/**
 * Plattformen der Produkt-Bibliothek (Spalte `supplier_products.platform`).
 * Nur Quellen mit offizieller API. Ohne Server-Code, darf auch im Browser genutzt werden.
 */

export const LIBRARY_SOURCES = [
  { id: "cj", name: "CJdropshipping", sourceId: "cj_dropshipping", popularity: "von Shops übernommen", popularityHint: "So oft haben Shops das Produkt bei CJ übernommen (Quelle: CJ API)" },
  { id: "aliexpress", name: "AliExpress", sourceId: null, popularity: "zuletzt verkauft", popularityHint: "Verkäufe der letzten Zeit laut AliExpress Affiliate API (Feld lastest_volume)" },
] as const;

export type LibraryPlatform = (typeof LIBRARY_SOURCES)[number]["id"];

export function librarySource(platform: string | null | undefined) {
  return LIBRARY_SOURCES.find((s) => s.id === platform) ?? null;
}

export function isLibraryPlatform(v: unknown): v is LibraryPlatform {
  return LIBRARY_SOURCES.some((s) => s.id === v);
}

/** Ein Treffer einer Lieferanten-Plattform, einheitlich für alle Quellen. */
export type SupplierProduct = {
  externalId: string;
  sku: string | null;
  title: string;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  categoryPath: string | null;
  /** Beliebtheit laut Plattform: CJ = Übernahmen durch Shops, AliExpress = Verkäufe der letzten Zeit. */
  listedCount: number | null;
  inventory: number | null;
  freeShipping: boolean | null;
  hasVideo: boolean | null;
  supplierName: string | null;
  listedAt: string | null;
  productUrl: string;
};

export type SupplierPage = { products: SupplierProduct[]; total: number; page: number; totalPages: number };

export type SupplierErrorKind = "auth" | "limit" | "request" | "network";

export class SupplierError extends Error {
  constructor(
    message: string,
    readonly kind: SupplierErrorKind,
  ) {
    super(message);
    this.name = "SupplierError";
  }
}
