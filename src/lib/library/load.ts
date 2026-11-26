import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryProduct } from "@/components/library/product-card";
import { dayDaysAgo } from "@/lib/shops/shops";
import { topHits, TOP_HITS, type Hit, type HitInput } from "@/lib/library/top-hits";

export const LIBRARY_COLUMNS =
  "id, title, image_url, price, currency, category_path, listed_count, free_shipping, has_video, product_url, relevance, relevance_reason, hidden, item_id, ai_relevant, ai_score, ai_reason";

type HitRow = LibraryProduct & {
  listed_at: string | null;
  search_terms: string[];
  supplier_product_snapshots: { day: string; listed_count: number | null }[];
};

/** Lädt Kandidaten (mit 14 Tagen Verlauf) und rechnet die Top-Hits. Ohne Migration 0008: leere Liste. */
export async function loadTopHits(supabase: SupabaseClient, limit = TOP_HITS): Promise<{ hit: Hit; product: LibraryProduct }[]> {
  const [hitsRes, adsRes] = await Promise.all([
    supabase
      .from("supplier_products")
      .select(`${LIBRARY_COLUMNS}, listed_at, search_terms, supplier_product_snapshots(day, listed_count)`)
      .eq("hidden", false)
      .neq("relevance", "irrelevant")
      .gte("supplier_product_snapshots.day", dayDaysAgo(14))
      .order("listed_count", { ascending: false, nullsFirst: false })
      .limit(400),
    supabase.rpc("ad_counts_by_term"),
  ]);
  const rows = (hitsRes.data ?? []) as unknown as HitRow[];
  const adsByTerm = new Map(((adsRes.data ?? []) as { term: string; ads: number }[]).map((r) => [r.term, Number(r.ads)]));
  const inputs: HitInput[] = rows.map((r) => ({
    id: r.id,
    listedCount: r.listed_count,
    listedAt: r.listed_at,
    relevance: r.relevance,
    hidden: r.hidden,
    imageUrl: r.image_url,
    searchTerms: r.search_terms ?? [],
    aiRelevant: r.ai_relevant,
    aiScore: r.ai_score,
    aiReason: r.ai_reason,
    snapshots: (r.supplier_product_snapshots ?? []).map((s) => ({ day: s.day, listedCount: s.listed_count })),
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return topHits(inputs, adsByTerm, limit).flatMap((hit) => {
    const product = byId.get(hit.id);
    return product ? [{ hit, product }] : [];
  });
}
