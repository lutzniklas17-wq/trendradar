import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewCounts = { products: number | null; startups: number | null; inbox: number | null; news: number | null };

/** Zeitpunkt vor `hours` Stunden (ISO), für „neu seit gestern“. */
export function hoursAgoIso(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

/** Zählt, was in den letzten 24 Stunden dazugekommen ist. `null` = Tabelle fehlt (Migration noch nicht gelaufen). */
export async function countNew(supabase: SupabaseClient, now = new Date()): Promise<NewCounts> {
  const since = hoursAgoIso(24, now);
  const head = { count: "exact" as const, head: true };
  const [products, startups, inbox, news] = await Promise.all([
    supabase.from("supplier_products").select("id", head).gte("first_seen_at", since).neq("relevance", "irrelevant"),
    supabase.from("items").select("id", head).eq("area", "startup_spy").gte("first_discovered_at", since),
    supabase.from("inbox_entries").select("id", head).is("read_at", null),
    supabase.from("news_articles").select("id", head).gte("fetched_at", since),
  ]);
  const n = (r: { error: unknown; count: number | null }) => (r.error ? null : (r.count ?? 0));
  return { products: n(products), startups: n(startups), inbox: n(inbox), news: n(news) };
}
