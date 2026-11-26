import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaEnv } from "@/lib/env";
import { buildPageAdsUrl, META_SOURCE_ID, type MetaAd } from "@/lib/ads/meta";
import { fetchArchive, metaErrorMessage, recordSightings, saveAdsWithIds } from "@/lib/ads/service";
import { addInboxEntry, shopChange, type Change } from "@/lib/inbox";
import { MAX_PAGES_PER_SHOP, summarizeShopAds, zurichDay, type ShopSummary } from "@/lib/shops/shops";

type FetchFn = typeof fetch;

export type TrackedShop = { id: string; page_id: string; name: string };

export type SnapshotResult =
  | { status: "ok"; summary: ShopSummary; capped: boolean; day: string; saved: boolean }
  | { status: "not_configured" }
  | { status: "error"; message: string };

/** Holt alle aktiven EU-Anzeigen einer Seite, höchstens MAX_PAGES_PER_SHOP Abfrageseiten. */
export async function fetchActivePageAds(
  pageId: string,
  creds: { accessToken: string; graphVersion?: string },
  fetchImpl: FetchFn = fetch,
): Promise<{ ads: MetaAd[]; capped: boolean }> {
  const ads: MetaAd[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES_PER_SHOP; page++) {
    const res = await fetchArchive(buildPageAdsUrl(pageId, after, creds.graphVersion), creds.accessToken, fetchImpl);
    ads.push(...res.ads);
    if (!res.nextCursor) return { ads, capped: false };
    after = res.nextCursor;
  }
  return { ads, capped: true };
}

/** Zählt die aktiven Anzeigen eines Shops und speichert den Snapshot des Tages (überschreibt einen früheren vom selben Tag). */
export async function snapshotShop(
  supabase: SupabaseClient,
  shop: TrackedShop,
  fetchImpl?: FetchFn,
  now = new Date(),
): Promise<SnapshotResult> {
  const env = getMetaEnv();
  if (!env) return { status: "not_configured" };
  try {
    const { ads, capped } = await fetchActivePageAds(shop.page_id, env, fetchImpl);
    const summary = summarizeShopAds(ads, now);
    const day = zurichDay(now);
    const { error } = await supabase.from("shop_snapshots").upsert(
      {
        shop_id: shop.id,
        day,
        active_ads: summary.activeAds,
        capped,
        domains: summary.domains,
        new_ads: summary.newAds,
        longest_days: summary.longestDays,
        checked_at: now.toISOString(),
      },
      { onConflict: "shop_id,day" },
    );
    // Anzeigen speichern und als „in der EU aktiv gesehen“ markieren: so erscheinen sie in der Rangliste und beim Shop.
    const ids = await saveAdsWithIds(supabase, ads);
    if (ids) await recordSightings(supabase, ids.values(), "EU", day);
    // Seitenname kann sich ändern; Meta liefert ihn mit jeder Anzeige.
    const name = ads.find((a) => a.pageName)?.pageName ?? shop.name;
    await supabase.from("tracked_shops").update({ name, last_checked_at: now.toISOString(), last_error: null }).eq("id", shop.id);
    await supabase.from("sources").update({ last_success_at: now.toISOString() }).eq("id", META_SOURCE_ID);
    return { status: "ok", summary, capped, day, saved: !error };
  } catch (e) {
    const message = metaErrorMessage(e);
    await supabase.from("tracked_shops").update({ last_checked_at: now.toISOString(), last_error: message.slice(0, 500) }).eq("id", shop.id);
    return { status: "error", message };
  }
}

/**
 * Zählt alle Shops, die heute noch keinen Snapshot haben (älteste zuerst).
 * Bricht bei einem Abfragelimit von Meta ab, damit nicht weitere Abfragen verbrannt werden.
 */
export async function snapshotDueShops(
  supabase: SupabaseClient,
  { max = 25, fetchImpl, now = new Date() }: { max?: number; fetchImpl?: FetchFn; now?: Date } = {},
) {
  const today = zurichDay(now);
  const { data: shops, error } = await supabase
    .from("tracked_shops")
    .select("*") // inkl. favorite ab Migration 0006, ohne dass der Lauf vorher scheitert
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) return { checked: 0, failed: 0, remaining: 0, error: "Shops konnten nicht geladen werden." };

  type Row = TrackedShop & { last_checked_at: string | null; favorite?: boolean };
  const due = ((shops ?? []) as Row[]).filter((s) => !s.last_checked_at || zurichDay(new Date(s.last_checked_at)) < today);
  const batch = due.slice(0, max);

  // Letzter Stand vor heute, um echte Änderungen für die Inbox zu erkennen.
  const previous = new Map<string, number>();
  if (batch.length) {
    const { data: prevRows } = await supabase
      .from("shop_snapshots")
      .select("shop_id, day, active_ads")
      .in("shop_id", batch.map((s) => s.id))
      .lt("day", today)
      .order("day", { ascending: false })
      .limit(2000);
    for (const r of (prevRows ?? []) as { shop_id: string; active_ads: number }[]) if (!previous.has(r.shop_id)) previous.set(r.shop_id, r.active_ads);
  }

  let checked = 0;
  let failed = 0;
  let stopError: string | null = null;
  const changes: Change[] = [];
  for (const shop of batch) {
    const res = await snapshotShop(supabase, shop, fetchImpl, now);
    if (res.status === "not_configured") {
      stopError = "META_ACCESS_TOKEN fehlt.";
      break;
    }
    if (res.status === "ok") {
      checked++;
      const prev = previous.get(shop.id) ?? null;
      const kind = shopChange(prev, res.summary.activeAds, Boolean(shop.favorite));
      if (kind) {
        changes.push({
          kind,
          label: shop.name,
          detail: kind === "removed" ? `keine aktiven Anzeigen mehr (vorher ${prev})` : `aktive Anzeigen ${prev} → ${res.summary.activeAds}${res.capped ? "+" : ""}`,
          href: `/shop-spy/${shop.id}`,
          favorite: Boolean(shop.favorite),
        });
      }
    } else {
      failed++;
      if (/Abfragelimit|Token/.test(res.message)) {
        stopError = res.message;
        break;
      }
    }
  }
  await addInboxEntry(supabase, "shops", "Shop-Zählung", changes);
  return { checked, failed, remaining: Math.max(0, due.length - checked - failed), error: stopError };
}
