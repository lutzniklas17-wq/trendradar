/** Zustand einer Datenquelle für die Übersicht „Datenquellen“. */
export type SourceState = "ok" | "stale" | "error" | "never" | "off";

export type SourceRow = { id: string; name: string; last_success_at: string | null; last_error_at: string | null; last_error: string | null };

/** Nach so vielen Stunden ohne Erfolg gilt eine tägliche Quelle als veraltet. */
export const STALE_HOURS = 48;

export const SOURCE_STATE_LABEL: Record<SourceState, string> = {
  ok: "läuft",
  stale: "veraltet",
  error: "Fehler",
  never: "noch nie gelaufen",
  off: "nicht verbunden",
};

export const SOURCE_STATE_TONE: Record<SourceState, "positive" | "warning" | "negative" | "neutral"> = {
  ok: "positive",
  stale: "warning",
  error: "negative",
  never: "neutral",
  off: "neutral",
};

/**
 * Leitet den Zustand aus dem letzten Erfolg und dem letzten Fehler ab.
 * Ein Fehler zählt nur, wenn er neuer ist als der letzte Erfolg.
 */
export function sourceState(row: Pick<SourceRow, "last_success_at" | "last_error_at"> | null, configured: boolean, now = new Date()): SourceState {
  if (!configured) return "off";
  const ok = row?.last_success_at ? Date.parse(row.last_success_at) : null;
  const err = row?.last_error_at ? Date.parse(row.last_error_at) : null;
  if (err !== null && (ok === null || err > ok)) return "error";
  if (ok === null) return "never";
  return now.getTime() - ok > STALE_HOURS * 3_600_000 ? "stale" : "ok";
}

/** Was eine Quelle liefert und was fehlt, wenn sie nicht verbunden ist. Reihenfolge = Anzeige. */
export const SOURCE_INFO: { id: string; label: string; feeds: string; missing: string }[] = [
  { id: "cj_dropshipping", label: "CJdropshipping", feeds: "Produkte, Beliebtheit, automatische Themen", missing: "CJ_API_KEY fehlt" },
  { id: "auto_topics", label: "Automatische Themen", feeds: "Themen und Anzeigen-Stichwörter aus den CJ-Produkten", missing: "braucht CJdropshipping" },
  { id: "meta_ad_library", label: "Meta Ad Library", feeds: "Anzeigen, Shop-Zählung, Ranglisten", missing: "META_ACCESS_TOKEN fehlt" },
  { id: "shop_discovery", label: "Shop-Entdeckung", feeds: "Shop Spy: neue Shops aus den Anzeigen", missing: "braucht Meta Ad Library" },
  { id: "meta_new_advertisers", label: "Neue Werbetreibende", feeds: "Startup Spy: Shops, die gerade mit Werbung starten", missing: "braucht Meta Ad Library" },
  { id: "dataforseo_trends", label: "Google Trends (DataForSEO)", feeds: "Suchinteresse und Verläufe", missing: "DATAFORSEO_LOGIN/PASSWORD fehlen" },
  { id: "product_hunt", label: "Product Hunt", feeds: "Startup Spy: neue Launches", missing: "PRODUCTHUNT_TOKEN fehlt" },
  { id: "rss", label: "RSS-Feeds", feeds: "Startup Spy, Future Radar", missing: "keine Feeds eingetragen" },
  { id: "aliexpress", label: "AliExpress", feeds: "Produkte", missing: "Schlüssel fehlen (zurückgestellt)" },
  { id: "anthropic", label: "KI-Bewertung (Claude)", feeds: "Einschätzungen", missing: "ANTHROPIC_API_KEY fehlt" },
];
