import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestTopics, type RisingQuery, type TitledEntry, type TopicSuggestion } from "@/lib/radar/suggest";
import { TRENDS_SOURCE_ID } from "@/lib/trends/dataforseo";
import { INSIGHTS_PREFIX, type TrendInsights } from "@/lib/trends/insights";

/** Lädt Titel der letzten 14 Tage, steigende Google-Suchanfragen der letzten 30 Tage und die beobachteten Themen. */
export async function loadTopicSuggestions(supabase: SupabaseClient, now = new Date()): Promise<TopicSuggestion[]> {
  const since14 = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [items, trends, topics] = await Promise.all([
    supabase
      .from("items")
      .select("name, first_discovered_at")
      .in("area", ["future_radar", "startup_spy"])
      .gte("first_discovered_at", since14)
      .order("first_discovered_at", { ascending: false })
      .limit(2000),
    supabase
      .from("trend_series")
      .select("payload, fetched_at")
      .eq("source_id", TRENDS_SOURCE_ID)
      .like("time_range", `${INSIGHTS_PREFIX}%`)
      .gte("fetched_at", since30)
      .order("fetched_at", { ascending: false })
      .limit(50),
    supabase.from("radar_topics").select("term"),
  ]);

  const entries: TitledEntry[] = (items.data ?? []).map((r) => ({ title: String(r.name ?? ""), date: String(r.first_discovered_at) }));
  const rising: RisingQuery[] = [];
  for (const row of trends.data ?? []) {
    const p = row.payload as Partial<TrendInsights> | null;
    for (const q of p?.risingQueries ?? []) {
      rising.push({ label: q.label, value: q.value, keyword: p?.keyword ?? "", fetchedAt: row.fetched_at });
    }
  }
  const existing = (topics.data ?? []).map((t) => String(t.term));
  return suggestTopics({ entries, rising, existing }, now);
}
