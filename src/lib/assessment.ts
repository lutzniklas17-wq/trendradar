/**
 * Produktanalyse und Bewertung.
 *
 * Gespeichert in der Tabelle `assessments`:
 * - `claims`: Liste von Aussagen, jede mit Abschnitt und Art (Fakt, Signal oder Einschätzung).
 * - `scores`: Bewertung je Kriterium (1–5 oder null, wenn die Daten nicht reichen), mit Begründung und Grundlage.
 * - `verdict`: Gesamturteil.
 *
 * Die Funktionen hier lesen die gespeicherten Daten vorsichtig ein: Unbekanntes wird verworfen statt erraten.
 */

export type ClaimKind = "fact" | "signal" | "assessment";

export const ANALYSIS_SECTIONS = [
  { key: "problem", label: "Problem", hint: "Welches Problem löst das Produkt?" },
  { key: "benefit", label: "Nutzen", hint: "Was hat der Kunde davon?" },
  { key: "target_group", label: "Zielgruppe", hint: "Wer kauft es?" },
  { key: "why_trending", label: "Warum es gerade gefragt ist", hint: "Auslöser und Signale" },
  { key: "marketing_hooks", label: "Marketing-Hooks", hint: "Aufhänger für Anzeigen und Videos" },
  { key: "competitors", label: "Konkurrenz", hint: "Wer verkauft es schon, zu welchem Preis?" },
  { key: "market_potential", label: "Marktpotenzial", hint: "Wie gross kann es werden?" },
  { key: "risks", label: "Risiken", hint: "Retouren, Recht, Plattformregeln, Qualität" },
  { key: "outlook", label: "Kurzfristig oder langfristig", hint: "Hype oder dauerhafter Bedarf?" },
] as const;

export type AnalysisSection = (typeof ANALYSIS_SECTIONS)[number]["key"];

export const CRITERIA = [
  { key: "trend", label: "Trendstärke", hint: "Steigt das Interesse messbar?" },
  { key: "demand", label: "Problem und Nachfrage", hint: "Löst es ein echtes Problem?" },
  { key: "margin", label: "Marge", hint: "Bleibt nach allen Kosten genug übrig?" },
  { key: "competition", label: "Wettbewerb", hint: "5 = wenig Konkurrenz" },
  { key: "ad_potential", label: "Werbetauglichkeit", hint: "Wow-Effekt, gut zu zeigen" },
  { key: "logistics", label: "Lieferung und Versand", hint: "Lieferzeit, Gewicht, Zerbrechlichkeit" },
  { key: "risk", label: "Risiko", hint: "5 = geringes Risiko (Retouren, Recht, Plattformen)" },
  { key: "longevity", label: "Langfristigkeit", hint: "Bleibt die Nachfrage?" },
] as const;

export type Criterion = (typeof CRITERIA)[number]["key"];

export type Claim = {
  section: AnalysisSection;
  kind: ClaimKind;
  text: string;
  sourceUrl?: string;
};

export type Score = {
  /** 1–5, null wenn die Datenlage nicht reicht */
  score: number | null;
  reason: string;
  /** Worauf die Bewertung beruht: gemessene Daten oder Einschätzung */
  basis: "data" | "assessment";
};

export type Verdict = "test" | "watch" | "skip";

export const VERDICTS: Record<Verdict, { label: string; tone: "positive" | "warning" | "negative" }> = {
  test: { label: "Testen", tone: "positive" },
  watch: { label: "Beobachten", tone: "warning" },
  skip: { label: "Nicht verfolgen", tone: "negative" },
};

export type Assessment = {
  id: string;
  model: string;
  createdAt: string;
  summary: string | null;
  claims: Claim[];
  scores: Partial<Record<Criterion, Score>>;
  verdict: Verdict | null;
  verdictReason: string | null;
};

const SECTION_KEYS = new Set<string>(ANALYSIS_SECTIONS.map((s) => s.key));
const CRITERION_KEYS = new Set<string>(CRITERIA.map((c) => c.key));
const CLAIM_KINDS = new Set<string>(["fact", "signal", "assessment"]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function safeHttpUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parseClaims(raw: unknown): Claim[] {
  if (!Array.isArray(raw)) return [];
  const claims: Claim[] = [];
  for (const c of raw) {
    if (!isObject(c)) continue;
    const { section, kind, text } = c;
    if (typeof section !== "string" || !SECTION_KEYS.has(section)) continue;
    if (typeof kind !== "string" || !CLAIM_KINDS.has(kind)) continue;
    if (typeof text !== "string" || !text.trim()) continue;
    const sourceUrl = safeHttpUrl(c.source_url);
    // Ein Fakt ohne Quelle ist nicht nachprüfbar und wird als Einschätzung behandelt.
    const effectiveKind = kind === "fact" && !sourceUrl ? "assessment" : (kind as ClaimKind);
    claims.push({ section: section as AnalysisSection, kind: effectiveKind, text: text.trim(), sourceUrl });
  }
  return claims;
}

export function parseScores(raw: unknown): Partial<Record<Criterion, Score>> {
  if (!isObject(raw)) return {};
  const scores: Partial<Record<Criterion, Score>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CRITERION_KEYS.has(key) || !isObject(value)) continue;
    const s = value.score;
    const score = typeof s === "number" && Number.isInteger(s) && s >= 1 && s <= 5 ? s : null;
    const reason = typeof value.reason === "string" ? value.reason.trim() : "";
    const basis = value.basis === "data" ? "data" : "assessment";
    scores[key as Criterion] = { score, reason, basis };
  }
  return scores;
}

export function parseVerdict(raw: unknown): { verdict: Verdict | null; reason: string | null } {
  if (typeof raw !== "string" || !raw.trim()) return { verdict: null, reason: null };
  // Format: "<urteil>: <begründung>" oder nur "<urteil>"
  const [head, ...rest] = raw.split(":");
  const key = head.trim().toLowerCase();
  const verdict = key in VERDICTS ? (key as Verdict) : null;
  const reason = verdict ? rest.join(":").trim() || null : raw.trim();
  return { verdict, reason };
}

/** Durchschnitt der bewerteten Kriterien; null, wenn weniger als die Hälfte bewertet ist. */
export function averageScore(scores: Partial<Record<Criterion, Score>>): { average: number | null; rated: number } {
  const values = CRITERIA.map((c) => scores[c.key]?.score).filter((v): v is number => v != null);
  const rated = values.length;
  if (rated < Math.ceil(CRITERIA.length / 2)) return { average: null, rated };
  return { average: values.reduce((a, b) => a + b, 0) / rated, rated };
}
