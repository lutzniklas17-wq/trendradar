/**
 * Kosten der KI-Bewertung. Preise laut Anthropic (Stand 11/2026), USD pro 1 Mio. Tokens.
 * Routine (Sortieren, Einstufen) läuft immer mit dem günstigsten Modell.
 */
export const AI_MODEL = "claude-haiku-5-5";
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Wie viel heute noch ausgegeben werden darf: Monatsbudget gleichmässig auf 30 Tage, nie über das Monatsbudget. */
export function remainingBudget(monthlyBudget: number, spentToday: number, spentMonth: number) {
  const daily = monthlyBudget / 30;
  return Math.max(0, Math.min(daily - spentToday, monthlyBudget - spentMonth));
}
