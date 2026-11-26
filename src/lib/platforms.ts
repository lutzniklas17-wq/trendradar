import type { BrandIconKey } from "@/lib/brand-icons";

/**
 * Plattformen für die Produktseite.
 *
 * - Lieferanten: dort wird eingekauft. Preis, Versand, Lieferzeit, MOQ und Bewertung je Angebot.
 * - Preisreferenz: nur zum Vergleichen der Endkundenpreise (z. B. Temu), kein Einkauf.
 * - Verkaufskanäle: dort wird verkauft. Strikt getrennt von den Lieferanten.
 *
 * Suchlinks führen auf die öffentliche Suche der Plattform. Es wird nichts automatisch ausgelesen:
 * Daten kommen nur aus offiziellen APIs (CJdropshipping, später AliExpress) oder aus deiner Eingabe.
 */

export type OfferRole = "supplier" | "price_reference";

export type SupplierPlatform = {
  id: "cj" | "aliexpress" | "alibaba" | "dhgate" | "temu";
  name: string;
  role: OfferRole;
  icon?: BrandIconKey;
  /** Kürzel und Farbe, wenn kein frei nutzbares Logo verfügbar ist */
  monogram: string;
  color: string;
  /** Erlaubte Domains für Angebotslinks (inkl. Subdomains) */
  domains: string[];
  searchUrl: (query: string) => string;
  /** Wie Daten in TrendRadar kommen */
  dataAccess: "api" | "api_planned" | "manual";
  note: string;
};

const q = (query: string) => encodeURIComponent(query.trim());

export const SUPPLIER_PLATFORMS: SupplierPlatform[] = [
  {
    id: "cj",
    name: "CJdropshipping",
    role: "supplier",
    monogram: "CJ",
    color: "#1f6feb",
    domains: ["cjdropshipping.com"],
    searchUrl: (query) => `https://cjdropshipping.com/search/${q(query)}.html`,
    dataAccess: "api",
    note: "Offizielle API: Preis, Mindestmenge, Versandkosten und Lieferzeit je Zielland.",
  },
  {
    id: "aliexpress",
    name: "AliExpress",
    role: "supplier",
    monogram: "AE",
    color: "#ff4747",
    domains: ["aliexpress.com", "aliexpress.us"],
    searchUrl: (query) => `https://www.aliexpress.com/wholesale?SearchText=${q(query)}`,
    dataAccess: "api_planned",
    note: "Affiliate-API möglich (braucht Freigabe durch AliExpress). Bis dahin manuell.",
  },
  {
    id: "alibaba",
    name: "Alibaba",
    role: "supplier",
    icon: "alibaba",
    monogram: "AB",
    color: "#ff6a00",
    domains: ["alibaba.com"],
    searchUrl: (query) => `https://www.alibaba.com/trade/search?SearchText=${q(query)}`,
    dataAccess: "manual",
    note: "Keine offene API. Grosshandel mit Mindestmengen, Preise oft auf Anfrage.",
  },
  {
    id: "dhgate",
    name: "DHgate",
    role: "supplier",
    monogram: "DH",
    color: "#e2231a",
    domains: ["dhgate.com"],
    searchUrl: (query) => `https://www.dhgate.com/wholesale/search.do?searchkey=${q(query)}`,
    dataAccess: "manual",
    note: "Keine offene API. Angebote manuell erfassen.",
  },
  {
    id: "temu",
    name: "Temu",
    role: "price_reference",
    monogram: "T",
    color: "#fb7701",
    domains: ["temu.com"],
    searchUrl: (query) => `https://www.temu.com/search_result.html?search_key=${q(query)}`,
    dataAccess: "manual",
    note: "Nur Preisvergleich: zeigt, wie billig Kunden das Produkt anderswo finden.",
  },
];

export type SalesChannel = {
  id: "shopify" | "amazon" | "tiktok_shop" | "woocommerce" | "etsy" | "ebay";
  name: string;
  icon?: BrandIconKey;
  monogram: string;
  color: string;
  description: string;
  /** Offizielle Gebührenseite, wo du die aktuellen Gebühren nachliest. Gebühren werden nie geschätzt. */
  feesUrl?: string;
  /** Konkurrenz auf dem Kanal ansehen, falls es eine öffentliche Suche gibt */
  searchUrl?: (query: string) => string;
};

export const SALES_CHANNELS: SalesChannel[] = [
  {
    id: "shopify",
    name: "Shopify",
    icon: "shopify",
    monogram: "S",
    color: "#7ab55c",
    description: "Eigener Shop. Volle Kontrolle über Marke und Marge, Traffic kommt über Werbung.",
    feesUrl: "https://www.shopify.com/pricing",
  },
  {
    id: "amazon",
    name: "Amazon",
    monogram: "a",
    color: "#ff9900",
    description: "Marktplatz mit eigener Nachfrage. Verkaufs- und FBA-Gebühren, starke Konkurrenz.",
    feesUrl: "https://sell.amazon.de/preise",
    searchUrl: (query) => `https://www.amazon.de/s?k=${q(query)}`,
  },
  {
    id: "tiktok_shop",
    name: "TikTok Shop",
    icon: "tiktok",
    monogram: "TT",
    color: "#000000",
    description:
      "Verkauf direkt in Videos und Lives. Nicht in allen Ländern verfügbar. Gebühren je Land im TikTok Seller Center.",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    monogram: "W",
    color: "#96588a",
    description: "Shop auf WordPress. Günstig im Betrieb, mehr Aufwand bei Technik und Wartung.",
    feesUrl: "https://woocommerce.com/pricing/",
  },
  {
    id: "etsy",
    name: "Etsy",
    icon: "etsy",
    monogram: "E",
    color: "#f16521",
    description: "Nur für handgemachte, Vintage- oder personalisierte Produkte geeignet.",
    feesUrl: "https://www.etsy.com/legal/fees/",
    searchUrl: (query) => `https://www.etsy.com/search?q=${q(query)}`,
  },
  {
    id: "ebay",
    name: "eBay",
    monogram: "eB",
    color: "#e53238",
    description: "Marktplatz mit eigener Nachfrage, stark bei Preisvergleich und Gebrauchtware.",
    feesUrl: "https://www.ebay.de/help/selling/fees-credits-invoices/gebuhren-fur-gewerbliche-verkaufer?id=4809",
    searchUrl: (query) => `https://www.ebay.de/sch/i.html?_nkw=${q(query)}`,
  },
];

export function getSupplierPlatform(id: string) {
  return SUPPLIER_PLATFORMS.find((p) => p.id === id);
}

/** Prüft, ob ein Link wirklich auf die Plattform zeigt (https, erlaubte Domain). */
export function isPlatformUrl(platform: SupplierPlatform, raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return platform.domains.some((d) => host === d || host.endsWith(`.${d}`));
}
