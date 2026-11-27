import type { TopicCandidate } from "@/lib/topics/extract";

/** Neue automatische Anzeigen-Stichwörter pro Tag (Meta begrenzt die Abfragen pro Stunde). */
export const AUTO_TERMS_PER_DAY = 6;
/** Höchstens so viele aktive automatische Stichwörter gleichzeitig (der Anzeigen-Lauf schafft ca. 25 pro Tag). */
export const AUTO_TERMS_MAX = 20;
/** Land für automatische Stichwörter: CJ-Titel sind englisch, Irland ist das englischsprachige EU-Land. */
export const AUTO_TERM_COUNTRY = "IE";
/** Ein automatisches Thema ruht, wenn es so lange in keiner Quelle mehr auftaucht. */
export const TOPIC_STALE_DAYS = 21;

/**
 * Welche Themen bekommen heute ein automatisches Anzeigen-Stichwort?
 * Nur Produkt-Themen (Nischen wie „Fans“ sind für eine Anzeigensuche zu breit), die häufigsten zuerst.
 */
export function pickNewAdTerms(
  candidates: Pick<TopicCandidate, "normalized" | "kind" | "productIds">[],
  { alreadyTermed, activeAuto, perDay = AUTO_TERMS_PER_DAY, max = AUTO_TERMS_MAX }: { alreadyTermed: Set<string>; activeAuto: number; perDay?: number; max?: number },
) {
  const room = Math.max(0, Math.min(perDay, max - activeAuto));
  return candidates
    .filter((c) => c.kind === "product" && !alreadyTermed.has(c.normalized))
    .sort((a, b) => b.productIds.length - a.productIds.length)
    .slice(0, room)
    .map((c) => c.normalized);
}

/** Ist ein automatisches Thema veraltet? Selbst eingetragene Themen ruhen nie automatisch. */
export function isStaleTopic(t: { origin: string; last_seen_at: string }, now = new Date(), days = TOPIC_STALE_DAYS) {
  return t.origin === "auto" && now.getTime() - Date.parse(t.last_seen_at) > days * 86_400_000;
}

/** Fakt-Text, warum ein Thema angelegt wurde. */
export function topicReason(c: Pick<TopicCandidate, "kind" | "productIds" | "listedSum">, day: string) {
  const what = c.kind === "niche" ? "Kategorie von" : "Begriff in den Titeln von";
  const listed = c.listedSum > 0 ? `, zusammen ${c.listedSum.toLocaleString("de-CH")}-mal von Shops übernommen` : "";
  return `${what} ${c.productIds.length} Produkten der CJ-Trend-, Neuheiten- und Suchlisten${listed} (Stand ${day}).`;
}
