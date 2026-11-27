import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMetaEnv } from "@/lib/env";
import { buildPageAdsUrl, META_SOURCE_ID, type MetaAd } from "@/lib/ads/meta";
import { fetchArchive, metaErrorMessage, recordSightings, saveAdsWithIds } from "@/lib/ads/service";
import { addInboxEntry, shopChange, type Change } from "@/lib/inbox";
import { MAX_PAGES_PER_SHOP, summarizeShopAds, zurichDay, type ShopSummary } from "@/lib/shops/shops";
import { AUTO_SHOP_DAYS, AUTO_SHOP_MIN_ADS, pickShops, shouldPauseAutoShop, type ShopCandidateRow } from "@/lib/shops/discover";

export const SHOP_DISCOVERY_SOURCE_ID = "shop_discovery";

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

  type Row = TrackedShop & { last_checked_at: string | null; favorite?: boolean; active?: boolean };
  // Pausierte automatische Shops (active = false, ab Migration 0009) werden nicht mehr gezählt.
  const due = ((shops ?? []) as Row[]).filter(
    (s) => s.active !== false && (!s.last_checked_at || zurichDay(new Date(s.last_checked_at)) < today),
  );
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

/**
 * Findet automatisch Shops aus den gesammelten Anzeigen (kostet keine Meta-Abfrage) und nimmt die stärksten in
 * die tägliche Zählung auf. Pausiert automatische Shops, die dreimal hintereinander keine aktiven Anzeigen hatten.
 */
export async function discoverShops(supabase: SupabaseClient, now = new Date()) {
  const { data: tracked, error: trackedError } = await supabase.from("tracked_shops").select("*").limit(2000);
  if (trackedError) return { error: "Shops konnten nicht geladen werden.", added: [] as { id: string; name: string }[], paused: 0 };
  type Row = { id: string; origin?: string; active?: boolean; favorite?: boolean };
  const rows = (tracked ?? []) as Row[];
  if (rows.length && rows[0].origin === undefined) {
    return { error: "Migration 0009 fehlt: automatische Shop-Entdeckung ist aus.", added: [], paused: 0 };
  }

  // Automatische Shops ohne Anzeigen pausieren.
  const autoActive = rows.filter((r) => r.origin === "auto" && r.active !== false);
  let paused = 0;
  if (autoActive.length) {
    const { data: snaps } = await supabase
      .from("shop_snapshots")
      .select("shop_id, day, active_ads")
      .in("shop_id", autoActive.map((r) => r.id))
      .order("day", { ascending: false })
      .limit(5000);
    const byShop = new Map<string, number[]>();
    for (const s of (snaps ?? []) as { shop_id: string; active_ads: number }[]) byShop.set(s.shop_id, [...(byShop.get(s.shop_id) ?? []), s.active_ads]);
    const toPause = autoActive.filter((r) => shouldPauseAutoShop(r, byShop.get(r.id) ?? [])).map((r) => r.id);
    if (toPause.length) {
      await supabase.from("tracked_shops").update({ active: false }).in("id", toPause);
      paused = toPause.length;
    }
  }

  const { data, error } = await supabase.rpc("shop_candidates", { p_days: AUTO_SHOP_DAYS, p_min_ads: AUTO_SHOP_MIN_ADS, p_limit: 200 });
  if (error) {
    await supabase.from("sources").update({ last_error_at: now.toISOString(), last_error: "Abfrage shop_candidates fehlgeschlagen (Migration 0009?)." }).eq("id", SHOP_DISCOVERY_SOURCE_ID);
    return { error: "Abfrage fehlgeschlagen (Migration 0009 ausgeführt?).", added: [], paused };
  }
  const picked = pickShops((data ?? []) as ShopCandidateRow[], { activeAuto: autoActive.length - paused });
  const added: { id: string; name: string }[] = [];
  if (picked.length) {
    const { data: inserted } = await supabase
      .from("tracked_shops")
      .upsert(
        picked.map((p) => ({ platform: "meta", page_id: p.page_id, name: p.name, domain: p.domain, origin: "auto", active: true, discovered_reason: p.reason })),
        { onConflict: "platform,page_id", ignoreDuplicates: true },
      )
      .select("id, name");
    added.push(...((inserted ?? []) as { id: string; name: string }[]));
  }
  await supabase.from("sources").update({ last_success_at: now.toISOString() }).eq("id", SHOP_DISCOVERY_SOURCE_ID);
  await addInboxEntry(
    supabase,
    "shops",
    "Automatisch entdeckte Shops",
    added.map((a) => ({ kind: "added" as const, label: a.name, detail: picked.find((p) => p.name === a.name)?.reason, href: `/shop-spy/${a.id}` })),
  );
  return { error: null, added, paused };
}
