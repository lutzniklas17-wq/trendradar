import type { SupabaseClient } from "@supabase/supabase-js";

// Verknüpfungen zwischen Produkt, Anzeigen, Shops und Google Trends – nur aus gespeicherten Daten, ohne neue API-Abfragen.

export type LinkedAd = {
  id: string;
  external_id: string;
  title: string | null;
  body: string | null;
  started_at: string | null;
  advertiser: { id: string; name: string; external_id: string } | null;
};

export type LinkedAdvertiser = { id: string; name: string; pageId: string; ads: number; trackedShopId: string | null };

/** Begriff für eine ilike-Suche: nur Buchstaben, Ziffern und Leerzeichen (kein Einschleusen von Filter-Syntax). */
export function safeSearchText(raw: string) {
  return raw.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Zählt Anzeigen je Werbetreibendem, meiste zuerst. Jede Anzeige zählt nur einmal. */
export function groupAdvertisers(ads: LinkedAd[], tracked: Map<string, string> = new Map()): LinkedAdvertiser[] {
  const seen = new Set<string>();
  const map = new Map<string, LinkedAdvertiser>();
  for (const ad of ads) {
    if (!ad.advertiser || seen.has(ad.id)) continue;
    seen.add(ad.id);
    const g = map.get(ad.advertiser.id) ?? {
      id: ad.advertiser.id,
      name: ad.advertiser.name,
      pageId: ad.advertiser.external_id,
      ads: 0,
      trackedShopId: tracked.get(ad.advertiser.external_id) ?? null,
    };
    g.ads++;
    map.set(g.id, g);
  }
  return [...map.values()].sort((a, b) => b.ads - a.ads || a.name.localeCompare(b.name));
}

/** Häufigste Anzeigentitel (meist der beworbene Produktname). Signal, keine bestätigte Produktliste. */
export function topTitles(titles: (string | null)[], max = 8) {
  const counts = new Map<string, { title: string; count: number }>();
  for (const raw of titles) {
    const t = raw?.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    const g = counts.get(key) ?? { title: t, count: 0 };
    g.count++;
    counts.set(key, g);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, max);
}

const AD_SELECT = "id, external_id, title, body, started_at, advertisers(id, name, external_id)";
type AdRow = Omit<LinkedAd, "advertiser"> & { advertisers: LinkedAd["advertiser"] | LinkedAd["advertiser"][] };
const toAd = (r: AdRow): LinkedAd => ({ ...r, advertiser: Array.isArray(r.advertisers) ? (r.advertisers[0] ?? null) : r.advertisers });

/**
 * Anzeigen zu einem Produkt: über die Sammel-Stichwörter des Produkts (ad_term_hits) und über den Produktnamen
 * im gespeicherten Anzeigentext. Beides stammt aus früheren Abfragen; keine neue Meta-Abfrage.
 */
export async function loadProductAds(supabase: SupabaseClient, item: { id: string; name: string }) {
  const termsRes = await supabase.from("ad_watch_terms").select("id, term, country, last_count, last_run_at").eq("item_id", item.id);
  const terms = (termsRes.data ?? []) as { id: string; term: string; country: string; last_count: number | null; last_run_at: string | null }[];

  const ads: LinkedAd[] = [];
  if (terms.length) {
    const hits = await supabase
      .from("ad_term_hits")
      .select(`ads(${AD_SELECT})`)
      .in("term_id", terms.map((t) => t.id))
      .limit(300);
    for (const h of (hits.data ?? []) as { ads: AdRow | AdRow[] | null }[]) {
      for (const a of Array.isArray(h.ads) ? h.ads : h.ads ? [h.ads] : []) ads.push(toAd(a));
    }
  }
  const text = safeSearchText(item.name);
  if (text.length >= 3) {
    const byText = await supabase
      .from("ads")
      .select(AD_SELECT)
      .or(`title.ilike.%${text}%,body.ilike.%${text}%`)
      .order("started_at", { ascending: true })
      .limit(100);
    for (const a of (byText.data ?? []) as AdRow[]) ads.push(toAd(a));
  }

  const pageIds = [...new Set(ads.map((a) => a.advertiser?.external_id).filter((x): x is string => !!x))];
  const tracked = new Map<string, string>();
  if (pageIds.length) {
    const t = await supabase.from("tracked_shops").select("id, page_id").in("page_id", pageIds.slice(0, 200));
    for (const s of (t.data ?? []) as { id: string; page_id: string }[]) tracked.set(s.page_id, s.id);
  }
  const unique = [...new Map(ads.map((a) => [a.id, a])).values()];
  return { terms, ads: unique, advertisers: groupAdvertisers(unique, tracked), error: termsRes.error ? "Migration 0004 fehlt." : null };
}

/** Zu einem Shop (Facebook-Seite): interne Werbetreibenden-ID, verknüpfte Produkte und häufigste Anzeigentitel. */
export async function loadShopLinks(supabase: SupabaseClient, pageId: string) {
  const adv = await supabase.from("advertisers").select("id").eq("platform", "meta").eq("external_id", pageId).maybeSingle();
  const advertiserId = (adv.data?.id as string | undefined) ?? null;
  if (!advertiserId) return { advertiserId: null, products: [], titles: [] };

  const adsRes = await supabase.from("ads").select("id, title").eq("advertiser_id", advertiserId).order("fetched_at", { ascending: false }).limit(500);
  const adRows = (adsRes.data ?? []) as { id: string; title: string | null }[];

  const products = new Map<string, { id: string; name: string; ads: number }>();
  if (adRows.length) {
    const hits = await supabase
      .from("ad_term_hits")
      .select("ad_id, ad_watch_terms(item_id, items(id, name))")
      .in("ad_id", adRows.slice(0, 300).map((a) => a.id))
      .limit(1000);
    type Hit = { ad_id: string; ad_watch_terms: { items: { id: string; name: string } | null } | null };
    for (const h of (hits.data ?? []) as unknown as Hit[]) {
      const item = h.ad_watch_terms?.items;
      if (!item) continue;
      const g = products.get(item.id) ?? { id: item.id, name: item.name, ads: 0 };
      g.ads++;
      products.set(item.id, g);
    }
  }
  return {
    advertiserId,
    products: [...products.values()].sort((a, b) => b.ads - a.ads),
    titles: topTitles(adRows.map((a) => a.title)),
  };
}
