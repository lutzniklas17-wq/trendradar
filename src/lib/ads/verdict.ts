/**
 * Kurze Einschätzungen für Anzeigen-Karten, nach festen Regeln aus Laufzeit und Anzahl Anzeigen.
 * Das sind Signale, keine Beweise: Meta liefert keine Verkaufszahlen und keine Ausgaben.
 */
import { runningDays, type AdCardData } from "@/lib/ads/feed";

export type AdSignal = { key: "evergreen" | "proven" | "new" | "scaling"; label: string; tone: "positive" | "accent"; title: string };

/** Ab so vielen Tagen gilt eine laufende Anzeige als „bewährt“ bzw. „Dauerläufer“. */
export const PROVEN_DAYS = 30;
export const EVERGREEN_DAYS = 90;
export const NEW_DAYS = 7;
/** Ab so vielen laufenden Anzeigen derselben Seite: „Shop skaliert“. */
export const SCALING_ACTIVE = 10;

export function adSignals(ad: Pick<AdCardData, "started_at" | "stopped_at" | "stats">, now = new Date()): AdSignal[] {
  if (ad.stopped_at) return [];
  const out: AdSignal[] = [];
  const days = runningDays(ad.started_at, null, now);
  if (days !== null && days >= EVERGREEN_DAYS) {
    out.push({ key: "evergreen", label: "Dauerläufer", tone: "positive", title: `Läuft seit ${days} Tagen. Wer so lange wirbt, verdient meist daran (Signal, kein Beweis).` });
  } else if (days !== null && days >= PROVEN_DAYS) {
    out.push({ key: "proven", label: "bewährt", tone: "positive", title: `Läuft seit ${days} Tagen, also länger als ${PROVEN_DAYS} Tage (Signal, kein Beweis).` });
  } else if (days !== null && days <= NEW_DAYS) {
    out.push({ key: "new", label: "neu", tone: "accent", title: `Erst seit ${days} ${days === 1 ? "Tag" : "Tagen"} aktiv.` });
  }
  if (ad.stats && ad.stats.active >= SCALING_ACTIVE) {
    out.push({ key: "scaling", label: "Shop skaliert", tone: "positive", title: `${ad.stats.active} laufende Anzeigen dieser Seite, soweit TrendRadar sie gesehen hat.` });
  }
  return out;
}

export type AdSummary = { total: number; active: number; proven: number; advertisers: number; longestDays: number | null; reach: number | null };

/** Kennzahlen über eine Trefferliste (nur Felder, die Meta wirklich liefert). */
export function summarizeAds(ads: Pick<AdCardData, "started_at" | "stopped_at" | "eu_reach" | "advertiser_name" | "page_id">[], now = new Date()): AdSummary {
  let active = 0;
  let proven = 0;
  let longest: number | null = null;
  let reach: number | null = null;
  const advertisers = new Set<string>();
  for (const ad of ads) {
    const days = runningDays(ad.started_at, ad.stopped_at, now);
    if (!ad.stopped_at) active++;
    if (!ad.stopped_at && days !== null && days >= PROVEN_DAYS) proven++;
    if (days !== null && (longest === null || days > longest)) longest = days;
    if (ad.eu_reach !== null) reach = (reach ?? 0) + ad.eu_reach;
    const who = ad.page_id ?? ad.advertiser_name;
    if (who) advertisers.add(who);
  }
  return { total: ads.length, active, proven, advertisers: advertisers.size, longestDays: longest, reach };
}
