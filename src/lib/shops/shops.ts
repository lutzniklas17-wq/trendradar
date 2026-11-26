/**
 * Shop Spy: aktive Anzeigen pro Werbetreibendem (Facebook-Seite) zählen und den Verlauf auswerten.
 * Reine Funktionen ohne Netzwerk.
 *
 * Grenzen, die in der Oberfläche genannt werden:
 * - Meta liefert normale Anzeigen nur, wenn sie in der EU ausgespielt werden. Gezählt wird also nur der EU-Teil.
 * - Eine Landingpage-URL liefert die API nicht. Die Domain stammt aus der Link-Beschriftung der Anzeige
 *   (ad_creative_link_captions), die meist, aber nicht immer, die Shop-Domain ist.
 */

import { runningDays, type MetaAd } from "@/lib/ads/meta";

/** Höchstens so viele Abfrageseiten pro Shop und Zählung (je 100 Anzeigen). Darüber gilt die Zahl als „mindestens“. */
export const MAX_PAGES_PER_SHOP = 10;

/** Anzeigen, die vor höchstens so vielen Tagen gestartet sind, gelten als „neu“. */
export const NEW_AD_DAYS = 7;

const PAGE_ID = /^\d{5,25}$/;

export type PageInput = { ok: true; pageId: string } | { ok: false; error: string };

/**
 * Liest eine Facebook-Seiten-ID aus einer Eingabe: reine Zahl, Ad-Library-Link (view_all_page_id)
 * oder profile.php?id=. Ein Link mit Seitennamen (facebook.com/meinshop) enthält keine ID.
 */
export function parsePageInput(raw: string): PageInput {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Bitte eine Seiten-ID oder einen Ad-Library-Link eingeben." };
  if (PAGE_ID.test(v)) return { ok: true, pageId: v };
  try {
    const url = new URL(v.startsWith("http") ? v : `https://${v}`);
    if (/(^|\.)facebook\.com$/.test(url.hostname)) {
      const id = url.searchParams.get("view_all_page_id") ?? url.searchParams.get("id");
      if (id && PAGE_ID.test(id)) return { ok: true, pageId: id };
    }
  } catch {
    // keine URL
  }
  return {
    ok: false,
    error:
      "Keine Seiten-ID gefunden. Am einfachsten im Ad Spy beim Werbetreibenden auf „Shop verfolgen“ klicken, oder in der Ad Library die Seite öffnen und den Link mit „view_all_page_id“ kopieren.",
  };
}

const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/** Macht aus einer Link-Beschriftung („WWW.SHOP.DE“, „https://shop.de/produkt“) eine Domain, sonst null. */
export function extractDomain(caption: string): string | null {
  let v = caption.trim().toLowerCase();
  if (!v || /\s/.test(v)) return null;
  v = v.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  v = v.split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  return DOMAIN.test(v) ? v : null;
}

/** Erste erkennbare Domain einer Anzeige oder null. */
export function adDomain(ad: Pick<MetaAd, "linkCaptions">): string | null {
  for (const c of ad.linkCaptions) {
    const d = extractDomain(c);
    if (d) return d;
  }
  return null;
}

export type ShopSummary = {
  activeAds: number;
  /** Anzahl aktiver Anzeigen je Domain. Schlüssel "" = ohne erkennbare Domain. */
  domains: Record<string, number>;
  /** Aktive Anzeigen, die in den letzten NEW_AD_DAYS Tagen gestartet sind. */
  newAds: number;
  /** Längste Laufzeit einer aktiven Anzeige in Tagen. */
  longestDays: number | null;
};

/** Zählt aktive Anzeigen (doppelte IDs nur einmal) und gruppiert sie nach Domain. */
export function summarizeShopAds(ads: MetaAd[], now = new Date()): ShopSummary {
  const seen = new Set<string>();
  const domains: Record<string, number> = {};
  let newAds = 0;
  let longestDays: number | null = null;
  for (const ad of ads) {
    if (seen.has(ad.id)) continue;
    seen.add(ad.id);
    const d = adDomain(ad) ?? "";
    domains[d] = (domains[d] ?? 0) + 1;
    const days = runningDays(ad, now);
    if (days !== null) {
      if (days <= NEW_AD_DAYS) newAds += 1;
      if (longestDays === null || days > longestDays) longestDays = days;
    }
  }
  return { activeAds: seen.size, domains, newAds, longestDays };
}

/** Domains absteigend nach Anzahl, ohne den Eintrag „ohne Domain“. */
export function sortedDomains(domains: Record<string, number>) {
  return Object.entries(domains)
    .filter(([d, n]) => d !== "" && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([domain, count]) => ({ domain, count }));
}

/** Kalendertag in Zürich als YYYY-MM-DD. Ein Snapshot pro Shop und Tag. */
export function zurichDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

export type Snapshot = { day: string; activeAds: number; capped: boolean };

export type ShopTrend = {
  latest: Snapshot;
  /** Vergleichswert: letzter Snapshot, der mindestens `days` Tage älter ist. */
  previous: Snapshot | null;
  delta: number | null;
  /** Starker Anstieg (mindestens verdoppelt und mindestens +5 Anzeigen, oder von 0 auf mindestens 5). Signal, kein Beweis. */
  scaling: boolean;
  /** Deutlicher Rückgang (mindestens halbiert und mindestens −5). */
  dropping: boolean;
};

/** Vergleicht den neusten Snapshot mit dem Stand vor mindestens `days` Tagen. */
export function shopTrend(snapshots: Snapshot[], days = 7): ShopTrend | null {
  if (!snapshots.length) return null;
  const sorted = [...snapshots].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted[sorted.length - 1];
  const previous = [...sorted].reverse().find((s) => dayDiff(latest.day, s.day) >= days) ?? null;
  if (!previous) return { latest, previous: null, delta: null, scaling: false, dropping: false };
  const delta = latest.activeAds - previous.activeAds;
  const scaling = previous.activeAds === 0 ? latest.activeAds >= 5 : latest.activeAds >= previous.activeAds * 2 && delta >= 5;
  const dropping = previous.activeAds > 0 && latest.activeAds * 2 <= previous.activeAds && delta <= -5;
  return { latest, previous, delta, scaling, dropping };
}

/** Anzeige der Anzahl, z. B. „mind. 1000“, wenn das Zähllimit erreicht wurde. */
export const formatCount = (n: number, capped: boolean) => `${capped ? "mind. " : ""}${n.toLocaleString("de-CH")}`;

/** Datum vor `days` Tagen als YYYY-MM-DD (für Abfragen des Verlaufs). */
export const dayDaysAgo = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
