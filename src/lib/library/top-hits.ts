/**
 * Top-Hits der Produkt-Bibliothek: nachvollziehbare Rangliste aus echten Daten.
 * Jede Begründung ist als Fakt (gemessener Wert), Signal (Veränderung oder Hinweis) oder
 * Einschätzung (KI) markiert. Ohne mindestens ein Signal wird ein Produkt kein Top-Hit.
 */

export type Claim = { kind: "fact" | "signal" | "assessment"; text: string };

export type Snapshot = { day: string; listedCount: number | null };

export type HitInput = {
  id: string;
  listedCount: number | null;
  listedAt: string | null;
  relevance: "relevant" | "unclear" | "irrelevant";
  hidden: boolean;
  imageUrl: string | null;
  searchTerms: string[];
  aiRelevant: boolean | null;
  aiScore: number | null;
  aiReason: string | null;
  snapshots: Snapshot[];
};

export type Hit = { id: string; score: number; claims: Claim[]; growth: number | null };

export const TOP_HITS = 12;
/** Ab so vielen Übernahmen durch Shops gilt ein Produkt als gefragt. */
export const LISTED_STRONG = 100;
export const NEW_DAYS = 30;

const DAY = 86_400_000;
const fmt = (n: number) => new Intl.NumberFormat("de-CH").format(n);

/**
 * Wachstum der Übernahmen durch Shops: jüngster Wert minus Wert von vor 5–10 Tagen.
 * Braucht mindestens zwei Messungen mit genug Abstand, sonst `null` (noch kein Verlauf).
 */
export function listedGrowth(snapshots: Snapshot[]) {
  const s = snapshots.filter((x) => x.listedCount !== null).sort((a, b) => b.day.localeCompare(a.day));
  if (s.length < 2) return null;
  const latest = s[0];
  const latestTime = Date.parse(latest.day);
  const base = s.find((x) => {
    const age = (latestTime - Date.parse(x.day)) / DAY;
    return age >= 5 && age <= 10;
  });
  if (!base) return null;
  const days = Math.round((latestTime - Date.parse(base.day)) / DAY);
  return { delta: (latest.listedCount ?? 0) - (base.listedCount ?? 0), days };
}

export function scoreProduct(p: HitInput, adsByTerm: Map<string, number>, now = new Date()): Hit | null {
  if (p.hidden || p.relevance === "irrelevant" || p.aiRelevant === false || !p.imageUrl) return null;
  const claims: Claim[] = [];
  let score = 0;
  let signals = 0;

  if (p.listedCount !== null) {
    claims.push({ kind: "fact", text: `${fmt(p.listedCount)}× von Shops bei CJ übernommen` });
    score += Math.log10(p.listedCount + 1) * 10;
    if (p.listedCount >= LISTED_STRONG) signals++;
  }

  const growth = listedGrowth(p.snapshots);
  if (growth && growth.delta > 0) {
    claims.push({ kind: "signal", text: `+${fmt(growth.delta)} Übernahmen in ${growth.days} Tagen` });
    score += Math.min(growth.delta, 500) / 5 + 10;
    signals++;
  }

  if (p.listedAt) {
    const age = (now.getTime() - Date.parse(p.listedAt)) / DAY;
    if (age >= 0 && age <= NEW_DAYS) {
      claims.push({ kind: "signal", text: `Seit ${Math.max(1, Math.round(age))} Tagen bei CJ (neu)` });
      score += 8;
      signals++;
    }
  }

  const ads = p.searchTerms
    .map((t) => ({ term: t, ads: adsByTerm.get(t.toLowerCase()) ?? 0 }))
    .sort((a, b) => b.ads - a.ads)[0];
  if (ads && ads.ads > 0) {
    claims.push({ kind: "signal", text: `${fmt(ads.ads)} bekannte Meta-Anzeigen zum Stichwort „${ads.term}“` });
    score += Math.min(Math.log10(ads.ads + 1) * 8, 25);
    signals++;
  }

  if (p.aiScore !== null) {
    claims.push({ kind: "assessment", text: `KI: ${p.aiScore}/5${p.aiReason ? `, ${p.aiReason}` : ""}` });
    score += (p.aiScore - 3) * 6;
  }

  if (p.relevance === "unclear") score -= 10;
  if (signals === 0) return null;
  return { id: p.id, score: Math.round(score * 10) / 10, claims, growth: growth?.delta ?? null };
}

export function topHits(products: HitInput[], adsByTerm: Map<string, number>, limit = TOP_HITS, now = new Date()) {
  return products
    .map((p) => scoreProduct(p, adsByTerm, now))
    .filter((h): h is Hit => h !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
