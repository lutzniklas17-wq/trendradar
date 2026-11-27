import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { zurichDay } from "@/lib/shops/shops";
import { CJ_SOURCE_ID } from "@/lib/library/cj";
import { META_SOURCE_ID } from "@/lib/ads/meta";
import { extractTopics, type TopicCandidate } from "@/lib/topics/extract";
import { AUTO_TERM_COUNTRY, isStaleTopic, pickNewAdTerms, topicReason } from "@/lib/topics/plan";

export const TOPICS_SOURCE_ID = "auto_topics";

type TopicRow = { id: string; normalized: string; origin: string; status: string; last_seen_at: string; image_url: string | null; source_ids: string[] | null };

/** Produkte der letzten Tage aus der Bibliothek (CJ-Trend-, Neuheiten- und Suchlisten), ohne irrelevante und ausgeblendete. */
async function recentLibraryProducts(supabase: SupabaseClient, now: Date) {
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("supplier_products")
    .select("id, title, category, listed_count, image_url")
    .gte("last_seen_at", since)
    .neq("relevance", "irrelevant")
    .eq("hidden", false)
    .order("listed_count", { ascending: false, nullsFirst: false })
    .limit(3000);
  if (error) return null;
  return ((data ?? []) as { id: string; title: string; category: string | null; listed_count: number | null; image_url: string | null }[]).map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    listedCount: p.listed_count,
    imageUrl: p.image_url,
  }));
}

/** Schreibt die Anzeigen-Kennzahlen aller Themen für heute (aus den gesammelten Anzeigen, kostet keine Abfrage). */
export async function recordTopicAdMetrics(supabase: SupabaseClient, now = new Date()) {
  // Darf den aufrufenden Lauf nie stoppen (z. B. ohne Migration 0009).
  const res = await Promise.resolve()
    .then(() => supabase.rpc("topic_ad_stats"))
    .catch(() => null);
  if (!res || res.error) return 0;
  const data = res.data;
  const day = zurichDay(now);
  const rows = ((data ?? []) as { topic_id: string; ads_active: number; ads_new_7d: number; advertisers: number }[]).flatMap((r) => [
    { topic_id: r.topic_id, day, metric: "ads_active", value: Number(r.ads_active), source_id: META_SOURCE_ID },
    { topic_id: r.topic_id, day, metric: "ads_new_7d", value: Number(r.ads_new_7d), source_id: META_SOURCE_ID },
    { topic_id: r.topic_id, day, metric: "ad_advertisers", value: Number(r.advertisers), source_id: META_SOURCE_ID },
  ]);
  if (rows.length) await supabase.from("topic_metrics").upsert(rows, { onConflict: "topic_id,metric,day" });
  return rows.length / 3;
}

export type TopicRunStats = {
  products: number;
  candidates: number;
  created: { id: string; name: string }[];
  updated: number;
  newTerms: string[];
  paused: number;
};

/**
 * Täglicher Themen-Lauf: leitet aus den Bibliotheksprodukten Themen ab, legt neue an (Duplikate über den
 * normalisierten Namen), speichert Messpunkte, erzeugt Anzeigen-Stichwörter für die stärksten neuen Themen
 * und lässt veraltete automatische Themen ruhen.
 */
export async function runTopicDiscovery(supabase: SupabaseClient, now = new Date()): Promise<TopicRunStats | { error: string }> {
  const products = await recentLibraryProducts(supabase, now);
  if (!products) return { error: "Bibliothek konnte nicht gelesen werden (Migration 0008?)." };
  const day = zurichDay(now);
  const candidates = extractTopics(products, { minProducts: 3, max: 40 });

  const { data: existingData, error: topicsError } = await supabase
    .from("topics")
    .select("id, normalized, origin, status, last_seen_at, image_url, source_ids")
    .limit(5000);
  if (topicsError) return { error: "Tabelle topics fehlt (Migration 0009 ausführen)." };
  const existing = new Map(((existingData ?? []) as TopicRow[]).map((t) => [t.normalized, t]));

  const created: { id: string; name: string }[] = [];
  let updated = 0;
  const idByNormalized = new Map<string, string>();
  for (const c of candidates) {
    const known = existing.get(c.normalized);
    if (known) {
      const sources = [...new Set([...(known.source_ids ?? []), CJ_SOURCE_ID])];
      await supabase
        .from("topics")
        .update({ last_seen_at: now.toISOString(), status: "active", image_url: known.image_url ?? c.imageUrl, source_ids: sources })
        .eq("id", known.id);
      idByNormalized.set(c.normalized, known.id);
      updated++;
    } else {
      const { data: row } = await supabase
        .from("topics")
        .insert({
          name: c.name,
          normalized: c.normalized,
          kind: c.kind,
          origin: "auto",
          category: c.category,
          image_url: c.imageUrl,
          reason: topicReason(c, day),
          source_ids: [CJ_SOURCE_ID],
          first_seen_at: now.toISOString(),
          last_seen_at: now.toISOString(),
        })
        .select("id")
        .single();
      if (row) {
        idByNormalized.set(c.normalized, row.id as string);
        created.push({ id: row.id as string, name: c.name });
      }
    }
  }

  // Messpunkte des Tages aus der Bibliothek.
  const metricRows = candidates.flatMap((c: TopicCandidate) => {
    const topic_id = idByNormalized.get(c.normalized);
    if (!topic_id) return [];
    return [
      { topic_id, day, metric: "cj_products", value: c.productIds.length, source_id: CJ_SOURCE_ID },
      { topic_id, day, metric: "cj_listed", value: c.listedSum, source_id: CJ_SOURCE_ID },
    ];
  });
  if (metricRows.length) await supabase.from("topic_metrics").upsert(metricRows, { onConflict: "topic_id,metric,day" });

  // Anzeigen-Stichwörter für die stärksten Produkt-Themen.
  const { data: termData } = await supabase.from("ad_watch_terms").select("id, term, active, origin, topic_id").limit(1000);
  const terms = (termData ?? []) as { id: string; term: string; active: boolean; origin?: string; topic_id?: string | null }[];
  const alreadyTermed = new Set(terms.map((t) => t.term.toLowerCase()));
  // Vorhandene, selbst eingetragene Stichwörter mit gleichem Namen werden dem Thema zugeordnet.
  for (const t of terms) {
    const topicId = idByNormalized.get(t.term.toLowerCase());
    if (topicId && !t.topic_id) await supabase.from("ad_watch_terms").update({ topic_id: topicId }).eq("id", t.id);
  }
  const activeAuto = terms.filter((t) => t.active && t.origin === "auto").length;
  const newTerms = pickNewAdTerms(candidates, { alreadyTermed, activeAuto });
  if (newTerms.length) {
    await supabase.from("ad_watch_terms").upsert(
      newTerms.map((term) => ({ term, country: AUTO_TERM_COUNTRY, origin: "auto", topic_id: idByNormalized.get(term) ?? null })),
      { onConflict: "term,country", ignoreDuplicates: true },
    );
  }

  // Veraltete automatische Themen ruhen lassen; ihre automatischen Stichwörter werden pausiert.
  const stale = [...existing.values()].filter((t) => t.status === "active" && !idByNormalized.has(t.normalized) && isStaleTopic(t, now));
  if (stale.length) {
    const ids = stale.map((t) => t.id);
    await supabase.from("topics").update({ status: "paused" }).in("id", ids);
    await supabase.from("ad_watch_terms").update({ active: false }).in("topic_id", ids).eq("origin", "auto");
  }

  await recordTopicAdMetrics(supabase, now);
  return { products: products.length, candidates: candidates.length, created, updated, newTerms, paused: stale.length };
}
