import type { Discovery } from "@/lib/collect/discoveries";
import { classifyRelevance } from "@/lib/startups/relevance";

export const NEW_ADVERTISERS_SOURCE_ID = "meta_new_advertisers";
/** Älteste bekannte Anzeige höchstens so viele Tage alt. */
export const NEW_ADVERTISER_DAYS = 60;
/** Höchstens so viele bekannte Anzeigen: darüber ist es eher kein kleiner, neuer Shop. */
export const NEW_ADVERTISER_MAX_ADS = 15;

/** Zeile aus der Datenbankfunktion new_advertisers (Migration 0007). */
export type NewAdvertiserRow = {
  advertiser_id: string;
  page_id: string;
  name: string;
  first_start: string;
  known_ads: number;
  domain: string | null;
  sample_text: string | null;
};

/** Domains, die kein eigener Shop sind (soziale Netzwerke, Linkdienste, App-Stores, Marktplätze). */
const NOT_A_SHOP = [
  "facebook.com", "fb.com", "fb.me", "m.me", "instagram.com", "whatsapp.com", "wa.me", "messenger.com", "tiktok.com",
  "youtube.com", "youtu.be", "linktr.ee", "linkin.bio", "apps.apple.com", "apple.com", "play.google.com", "google.com",
  "amazon.com", "amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.nl", "ebay.com", "ebay.de", "etsy.com",
  "aliexpress.com", "temu.com", "shein.com", "zalando.de", "zalando.ch", "galaxus.ch", "digitec.ch", "ricardo.ch",
];

/** Eigene Shop-Domain? (keine Plattform, kein Marktplatz) */
export function isShopDomain(domain: string | null | undefined) {
  if (!domain) return false;
  const d = domain.toLowerCase().replace(/^www\./, "");
  return !NOT_A_SHOP.some((n) => d === n || d.endsWith(`.${n}`));
}

/** Öffentlicher Ad-Library-Link zu allen Anzeigen einer Seite (enthält kein Token). */
export function pageLibraryUrl(pageId: string) {
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${encodeURIComponent(pageId)}`;
}

/**
 * Macht aus einem neuen Werbetreibenden einen Startup-Spy-Eintrag.
 * Ohne eigene Shop-Domain wird er übersprungen (null): Ohne Shop ist es für E-Commerce nicht auswertbar.
 * Ausgeschlossene Branchen (Öl, Finanzen, B2B-Software …) ebenfalls.
 */
export function toNewAdvertiserDiscovery(row: NewAdvertiserRow): Discovery | null {
  if (!row.page_id || !row.name || !isShopDomain(row.domain)) return null;
  const relevance = classifyRelevance([row.name, row.domain, row.sample_text], { hasShopDomain: true });
  if (relevance.relevance === "excluded") return null;
  return {
    name: row.name,
    type: "brand",
    area: "startup_spy",
    sourceId: NEW_ADVERTISERS_SOURCE_ID,
    sourceUrl: pageLibraryUrl(row.page_id),
    description: row.sample_text ? row.sample_text.split(" | ")[0].trim().slice(0, 300) || null : null,
    category: null,
    websiteUrl: `https://${row.domain}`,
    stage: "small_business",
    launchedAt: row.first_start,
    relevance,
    signal: { metric: "meta_known_ads", value: Number(row.known_ads), unit: "bekannte Anzeigen" },
  };
}
