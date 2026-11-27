import { classifyRelevance } from "@/lib/startups/relevance";
import { isShopDomain } from "@/lib/startups/new-advertisers";

/** Neue automatisch entdeckte Shops pro Tag. */
export const AUTO_SHOPS_PER_DAY = 8;
/** Höchstens so viele aktive automatische Shops (der tägliche Zähl-Lauf schafft ca. 40 Shops). */
export const AUTO_SHOPS_MAX = 30;
/** Mindestens so viele verschiedene Anzeigen in den letzten Tagen als aktiv gesehen. */
export const AUTO_SHOP_MIN_ADS = 5;
/** Zeitraum für „aktiv gesehen“ in Tagen. */
export const AUTO_SHOP_DAYS = 3;

/** Zeile aus der Datenbankfunktion shop_candidates (Migration 0009). */
export type ShopCandidateRow = {
  advertiser_id: string;
  page_id: string;
  name: string;
  active_ads: number;
  first_start: string | null;
  domain: string | null;
  terms: string[] | null;
  sample_text: string | null;
};

export type PickedShop = { page_id: string; name: string; domain: string; reason: string };

/**
 * Welche Werbetreibenden werden heute automatisch verfolgt? Nur mit eigener Shop-Domain (kein Marktplatz,
 * kein soziales Netzwerk) und ohne ausgeschlossene Branche, die mit den meisten aktiven Anzeigen zuerst.
 */
export function pickShops(rows: ShopCandidateRow[], { activeAuto, perDay = AUTO_SHOPS_PER_DAY, max = AUTO_SHOPS_MAX }: { activeAuto: number; perDay?: number; max?: number }): PickedShop[] {
  const room = Math.max(0, Math.min(perDay, max - activeAuto));
  return rows
    .filter((r) => r.page_id && /^[0-9]{5,25}$/.test(r.page_id) && isShopDomain(r.domain))
    .filter((r) => classifyRelevance([r.name, r.domain, r.sample_text], { hasShopDomain: true }).relevance !== "excluded")
    .sort((a, b) => Number(b.active_ads) - Number(a.active_ads))
    .slice(0, room)
    .map((r) => ({
      page_id: r.page_id,
      name: r.name.slice(0, 200),
      domain: String(r.domain).toLowerCase().replace(/^www\./, ""),
      reason:
        `${r.active_ads} verschiedene Anzeigen in den letzten ${AUTO_SHOP_DAYS} Tagen aktiv gesehen` +
        (r.terms?.length ? ` (Stichwörter: ${r.terms.slice(0, 3).join(", ")})` : "") +
        ".",
    }));
}

/**
 * Wird ein automatisch entdeckter Shop nicht mehr gezählt? Wenn die letzten drei Zählungen 0 aktive Anzeigen
 * ergaben. Favoriten und selbst hinzugefügte Shops werden nie automatisch pausiert.
 */
export function shouldPauseAutoShop(shop: { origin?: string | null; favorite?: boolean | null }, recentActiveAds: number[]) {
  if (shop.origin !== "auto" || shop.favorite) return false;
  return recentActiveAds.length >= 3 && recentActiveAds.slice(0, 3).every((n) => n === 0);
}
