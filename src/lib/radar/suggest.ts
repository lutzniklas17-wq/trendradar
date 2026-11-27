/**
 * Future Radar findet Themen selbst: Vorschläge aus den eigenen Daten, ohne KI und ohne Kosten.
 *
 * 1. Wörter und Wortpaare, die in den Titeln gesammelter Einträge (Future Radar, Startup Spy)
 *    diese Woche deutlich öfter vorkommen als in der Vorwoche.
 * 2. Steigende Suchanfragen aus bereits gespeicherten Google-Trends-Abfragen.
 *
 * Jeder Vorschlag nennt seinen Grund mit Zahlen. Das ist ein Signal, keine Bewertung.
 */

export type TitledEntry = { title: string; date: string };
export type RisingQuery = { label: string; value: number | null; keyword: string; fetchedAt: string };

export type TopicSuggestion = {
  term: string;
  source: "entries" | "trends";
  reason: string;
  /** Zum Sortieren: höher = stärker. */
  score: number;
};

/** Mindestanzahl Nennungen diese Woche, damit ein Wort als Vorschlag gilt. */
export const MIN_MENTIONS = 3;
/** Steigende Google-Suchanfragen erst ab diesem Zuwachs in Prozent (null = „Durchbruch“ zählt immer). */
export const MIN_RISE_PCT = 100;
export const MAX_SUGGESTIONS = 8;

const STOPWORDS = new Set(
  (
    "der die das den dem des ein eine einer eines einem einen und oder aber mit für von vom zum zur auf aus bei nach über unter vor im in am an ist sind war " +
    "wird werden wurde hat haben kann können mehr neue neuer neues neu wie was wer wo warum nicht noch auch nur schon jetzt heute so sich sie er es wir ihr ich " +
    "dass als bis durch gegen ohne um alle alles diese dieser dieses jahr jahre jahren prozent mal immer zwei drei erste ersten " +
    "the a an and or but with for from of on in at to by is are was were be been has have had can will new more how what why who when where your you our " +
    "this that these those it its into about over just now today top best first get gets launch launches launched announces introducing via vs " +
    "startup startups shop shops store brand brands product products company inc gmbh ag"
  ).split(" "),
);

/** Kleinbuchstaben-Wörter ab 3 Zeichen, ohne Füllwörter und reine Zahlen. */
export function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/** Wörter und direkt aufeinanderfolgende Wortpaare eines Titels, jeweils nur einmal pro Titel gezählt. */
export function terms(title: string): string[] {
  const words = tokenize(title);
  const set = new Set(words);
  for (let i = 0; i < words.length - 1; i++) set.add(`${words[i]} ${words[i + 1]}`);
  return [...set];
}

const WEEK = 7 * 86_400_000;

function fromEntries(entries: TitledEntry[], now: Date): TopicSuggestion[] {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const e of entries) {
    const age = now.getTime() - new Date(e.date).getTime();
    if (Number.isNaN(age) || age < 0 || age >= 2 * WEEK) continue;
    const target = age < WEEK ? current : previous;
    for (const t of terms(e.title)) target.set(t, (target.get(t) ?? 0) + 1);
  }
  const rising: TopicSuggestion[] = [];
  for (const [term, cur] of current) {
    const prev = previous.get(term) ?? 0;
    if (cur < MIN_MENTIONS || cur < prev * 2) continue;
    rising.push({
      term,
      source: "entries",
      reason: prev ? `${cur}× in Titeln diese Woche, Vorwoche ${prev}×` : `${cur}× in Titeln diese Woche, Vorwoche nie`,
      // Wortpaare sind aussagekräftiger als Einzelwörter.
      score: (cur - prev) * (term.includes(" ") ? 1.5 : 1),
    });
  }
  // Einzelwort weglassen, wenn ein Wortpaar mit ihm mindestens gleich oft vorkommt.
  return rising.filter(
    (s) => s.term.includes(" ") || !rising.some((o) => o.term.includes(" ") && o.term.split(" ").includes(s.term) && (current.get(o.term) ?? 0) >= (current.get(s.term) ?? 0)),
  );
}

function fromTrends(queries: RisingQuery[]): TopicSuggestion[] {
  return queries
    .filter((q) => q.value === null || q.value >= MIN_RISE_PCT)
    .map((q) => ({
      term: q.label.toLowerCase(),
      source: "trends" as const,
      reason: `Google Trends: ${q.value === null ? "Durchbruch (über +5000 %)" : `+${q.value.toLocaleString("de-CH")} %`} als verwandte Suche zu „${q.keyword}“`,
      score: q.value === null ? 50 : Math.min(50, q.value / 100),
    }));
}

/** Vorschläge ohne bereits beobachtete Themen, stärkste zuerst, jedes Thema nur einmal. */
export function suggestTopics(input: { entries: TitledEntry[]; rising: RisingQuery[]; existing: string[] }, now = new Date()): TopicSuggestion[] {
  const existing = input.existing.map((e) => e.toLowerCase().trim());
  const wrap = (t: string) => ` ${t} `;
  const isKnown = (term: string) => existing.some((e) => wrap(term).includes(wrap(e)) || wrap(e).includes(wrap(term)));
  const seen = new Set<string>();
  return [...fromEntries(input.entries, now), ...fromTrends(input.rising)]
    .filter((s) => s.term.length >= 3 && s.term.length <= 60 && !isKnown(s.term))
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .filter((s) => (seen.has(s.term) ? false : (seen.add(s.term), true)))
    .slice(0, MAX_SUGGESTIONS);
}
