/**
 * Future Radar: Fakten → Signal → Einschätzung.
 * Fakten sind gezählte Treffer in den eigenen Daten (mit Quelle). Das Signal ist die Veränderung zur Vorwoche.
 * Die Einschätzung folgt festen, sichtbaren Regeln (keine KI) und wird immer als Einschätzung beschriftet.
 */
export type TopicStats = {
  topic_id: string;
  term: string;
  note: string | null;
  created_at: string;
  news_7d: number;
  news_prev_7d: number;
  items_30d: number;
  ads_active: number;
  ads_new_7d: number;
  ads_new_prev_7d: number;
  has_ad_term: boolean;
  /** Ältester gespeicherter News-Artikel: zeigt, wie weit der Verlauf zurückreicht. */
  news_since: string | null;
};

export type Outlook = "rising" | "emerging" | "stable" | "falling" | "too_little";

export const OUTLOOK_LABEL: Record<Outlook, string> = {
  rising: "steigend",
  emerging: "neu aufgetaucht",
  stable: "stabil",
  falling: "rückläufig",
  too_little: "zu wenig Daten",
};

/** Mindestanzahl Treffer, damit überhaupt eine Einschätzung abgegeben wird. */
export const MIN_SIGNALS = 3;
/** Ohne zwei volle Wochen Verlauf ist ein Vorwochen-Vergleich nicht aussagekräftig. */
export const MIN_HISTORY_DAYS = 14;

export type Assessment = { outlook: Outlook; reason: string; current: number; previous: number };

/** Treffer dieser Woche und der Vorwoche (News + neu gestartete Anzeigen). */
export function weeklyCounts(s: Pick<TopicStats, "news_7d" | "news_prev_7d" | "ads_new_7d" | "ads_new_prev_7d">) {
  return { current: Number(s.news_7d) + Number(s.ads_new_7d), previous: Number(s.news_prev_7d) + Number(s.ads_new_prev_7d) };
}

export function assessTopic(s: TopicStats, now = new Date()): Assessment {
  const { current, previous } = weeklyCounts(s);
  const historyDays = s.news_since ? (now.getTime() - new Date(s.news_since).getTime()) / 86_400_000 : 0;
  const base = { current, previous };
  if (current + previous + Number(s.items_30d) < MIN_SIGNALS) {
    return { ...base, outlook: "too_little", reason: `Weniger als ${MIN_SIGNALS} Treffer in News, Anzeigen und Einträgen.` };
  }
  if (previous === 0 && current >= MIN_SIGNALS && historyDays >= MIN_HISTORY_DAYS) {
    return { ...base, outlook: "emerging", reason: `Vorwoche 0 Treffer, diese Woche ${current}.` };
  }
  if (historyDays < MIN_HISTORY_DAYS) {
    return { ...base, outlook: "too_little", reason: `Verlauf erst ${Math.floor(historyDays)} Tage, für einen Vergleich braucht es ${MIN_HISTORY_DAYS}.` };
  }
  if (current >= previous * 2 && current - previous >= MIN_SIGNALS) {
    return { ...base, outlook: "rising", reason: `Mindestens doppelt so viele Treffer wie in der Vorwoche (${current} statt ${previous}).` };
  }
  if (current * 2 <= previous && previous - current >= MIN_SIGNALS) {
    return { ...base, outlook: "falling", reason: `Höchstens halb so viele Treffer wie in der Vorwoche (${current} statt ${previous}).` };
  }
  return { ...base, outlook: "stable", reason: `Ähnlich viele Treffer wie in der Vorwoche (${current} statt ${previous}).` };
}

/** Veränderung als Text, z. B. „+4 ggü. Vorwoche“. */
export function changeLabel(current: number, previous: number) {
  const diff = current - previous;
  return `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff)} ggü. Vorwoche`;
}

/** Thema aus einem Eingabefeld: getrimmt, 2–60 Zeichen. */
export function parseTopic(raw: string): string | null {
  const v = raw.replace(/\s+/g, " ").trim();
  return v.length >= 2 && v.length <= 60 ? v : null;
}
