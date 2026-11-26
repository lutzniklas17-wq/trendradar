import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicEnv } from "@/lib/env";
import { zurichDay } from "@/lib/shops/shops";
import { AI_MODEL, costUsd, remainingBudget } from "@/lib/ai/pricing";

/** Produkte pro Anfrage (eine Anfrage für viele Produkte ist günstiger als einzelne). */
export const AI_BATCH = 20;
/** Höchstens so viele Produkte pro täglichem Lauf. */
export const AI_MAX_PER_RUN = 100;

const SYSTEM = `Du bewertest Produkte eines Dropshipping-Lieferanten für einen kleinen Online-Shop (Endkunden, Europa).
Für jedes Produkt:
- relevant: true, wenn sich das Produkt als eigenständiges Endkundenprodukt online verkaufen lässt. false bei Rohstoffen, Steinen, Ersatzteilen, Bauteilen, Werkstatt- oder Industriebedarf, Grosshandelsware, Verpackungsmaterial, reinen Zubehör-Kleinteilen ohne Kaufgrund.
- score: 1 bis 5, wie gut es sich als Produkt für Social-Media-Werbung eignet (Problemlöser, Wow-Effekt, sichtbar im Video, Marge möglich, nicht überall im Laden erhältlich). 3 = durchschnittlich.
- reason: höchstens 12 Wörter auf Deutsch (Schweizer Schreibweise, „ss“ statt „ß“), konkret zum Produkt.
Erfinde keine Verkaufszahlen. Bewerte nur anhand von Titel, Kategorie und Preis.`;

const ReviewSchema = z.object({
  reviews: z.array(z.object({ id: z.string(), relevant: z.boolean(), score: z.number().int().min(1).max(5), reason: z.string() })),
});

type Candidate = { id: string; title: string; category_path: string | null; price: number | null };

export type ReviewRun = { status: "success" | "partial" | "skipped" | "failed"; message: string; reviewed: number; costUsd: number };

async function spent(supabase: SupabaseClient, now: Date) {
  const today = zurichDay(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data } = await supabase.from("api_usage").select("day, cost_usd").eq("provider", "anthropic").gte("day", monthStart);
  const rows = (data ?? []) as { day: string; cost_usd: number }[];
  return {
    today: rows.filter((r) => r.day === today).reduce((s, r) => s + Number(r.cost_usd), 0),
    month: rows.reduce((s, r) => s + Number(r.cost_usd), 0),
  };
}

/**
 * Täglicher KI-Lauf: bewertet noch nicht bewertete Bibliotheks-Produkte (die meistübernommenen zuerst).
 * Läuft nur mit ANTHROPIC_API_KEY und stoppt, sobald das Tagesbudget (Monatsbudget / 30) aufgebraucht ist.
 */
export async function runProductReview(supabase: SupabaseClient, now = new Date(), client?: Anthropic): Promise<ReviewRun> {
  const env = getAnthropicEnv();
  if (!env) return { status: "skipped", message: "ANTHROPIC_API_KEY fehlt, KI-Bewertung ist aus.", reviewed: 0, costUsd: 0 };

  const s = await spent(supabase, now);
  let budget = remainingBudget(env.monthlyBudgetUsd, s.today, s.month);
  if (budget <= 0) return { status: "skipped", message: "KI-Budget für heute aufgebraucht.", reviewed: 0, costUsd: 0 };

  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, title, category_path, price")
    .is("ai_reviewed_at", null)
    .eq("hidden", false)
    .neq("relevance", "irrelevant")
    .order("listed_count", { ascending: false, nullsFirst: false })
    .limit(AI_MAX_PER_RUN);
  if (error) return { status: "failed", message: "Produkte konnten nicht geladen werden (Migration 0008?).", reviewed: 0, costUsd: 0 };
  const candidates = (data ?? []) as Candidate[];
  if (!candidates.length) return { status: "skipped", message: "Keine neuen Produkte zum Bewerten.", reviewed: 0, costUsd: 0 };

  const anthropic = client ?? new Anthropic({ apiKey: env.apiKey, maxRetries: 2, timeout: 60_000 });
  let reviewed = 0;
  let total = 0;
  let failures = 0;

  for (let i = 0; i < candidates.length && budget > 0; i += AI_BATCH) {
    const batch = candidates.slice(i, i + AI_BATCH);
    const list = batch.map((c) => ({ id: c.id, title: c.title, category: c.category_path, price_usd: c.price }));
    try {
      const response = await anthropic.messages.parse({
        model: AI_MODEL,
        max_tokens: 4000,
        output_config: { effort: "low", format: zodOutputFormat(ReviewSchema) },
        system: SYSTEM,
        messages: [{ role: "user", content: `Produkte (JSON):\n${JSON.stringify(list)}` }],
      });
      const cost = costUsd(AI_MODEL, response.usage.input_tokens, response.usage.output_tokens);
      total += cost;
      budget -= cost;
      await supabase.rpc("bump_api_usage", {
        p_provider: "anthropic",
        p_day: zurichDay(now),
        p_calls: 1,
        p_input: response.usage.input_tokens,
        p_output: response.usage.output_tokens,
        p_cost: cost,
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) {
        failures++;
        continue;
      }
      const ids = new Set(batch.map((c) => c.id));
      for (const r of response.parsed_output.reviews) {
        if (!ids.has(r.id)) continue; // nur Produkte aus dieser Anfrage
        await supabase
          .from("supplier_products")
          .update({ ai_relevant: r.relevant, ai_score: r.score, ai_reason: r.reason.slice(0, 160), ai_model: AI_MODEL, ai_reviewed_at: now.toISOString() })
          .eq("id", r.id);
        reviewed++;
      }
    } catch (e) {
      failures++;
      if (e instanceof Anthropic.AuthenticationError) return { status: "failed", message: "ANTHROPIC_API_KEY wurde abgelehnt.", reviewed, costUsd: total };
      if (e instanceof Anthropic.RateLimitError) break;
    }
  }

  const status = failures && !reviewed ? "failed" : failures || budget <= 0 ? "partial" : "success";
  return {
    status,
    message: `${reviewed} Produkte bewertet, Kosten ca. ${total.toFixed(4)} USD` + (budget <= 0 ? ", Tagesbudget erreicht." : "."),
    reviewed,
    costUsd: total,
  };
}
