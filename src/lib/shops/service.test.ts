import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const { fetchActivePageAds, snapshotShop } = await import("./service");

function fakeSupabase() {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "upsert", "update", "order", "limit"]) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ table, op: m, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const page = (ids: string[], after: string | null) => ({
  data: ids.map((id) => ({ id, page_id: "123456", page_name: "Neuer Name", ad_creative_link_captions: ["SHOP.DE"], ad_delivery_start_time: "2026-11-25" })),
  paging: after ? { cursors: { after }, next: "https://graph.facebook.com/next" } : { cursors: {} },
});

afterEach(() => vi.unstubAllEnvs());

describe("fetchActivePageAds", () => {
  it("folgt dem Cursor bis zur letzten Seite", async () => {
    const bodies = [page(["1", "2"], "c1"), page(["3"], null)];
    const f = vi.fn(async () => new Response(JSON.stringify(bodies.shift()))) as unknown as typeof fetch;
    const res = await fetchActivePageAds("123456", { accessToken: "geheim" }, f);
    expect(res.ads.map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(res.capped).toBe(false);
    const secondUrl = new URL(String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[1][0]));
    expect(secondUrl.searchParams.get("after")).toBe("c1");
    expect(secondUrl.searchParams.get("search_page_ids")).toBe('["123456"]');
    expect(secondUrl.searchParams.get("ad_active_status")).toBe("ACTIVE");
  });

  it("markiert das Ergebnis als „mindestens“, wenn das Seitenlimit erreicht wird", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(page(["x"], "weiter")))) as unknown as typeof fetch;
    const res = await fetchActivePageAds("123456", { accessToken: "geheim" }, f);
    expect(res.capped).toBe(true);
  });
});

describe("snapshotShop", () => {
  it("ohne Token: nicht konfiguriert", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    const { client } = fakeSupabase();
    const res = await snapshotShop(client, { id: "s1", page_id: "123456", name: "Shop" });
    expect(res.status).toBe("not_configured");
  });

  it("speichert den Tages-Snapshot und aktualisiert den Namen", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "geheim");
    const { client, calls } = fakeSupabase();
    const f = vi.fn(async () => new Response(JSON.stringify(page(["1", "2"], null)))) as unknown as typeof fetch;
    const res = await snapshotShop(client, { id: "s1", page_id: "123456", name: "Alt" }, f, new Date("2026-11-26T12:00:00Z"));
    expect(res.status).toBe("ok");
    const snap = calls.find((c) => c.table === "shop_snapshots" && c.op === "upsert");
    expect(snap?.args[0]).toMatchObject({ shop_id: "s1", day: "2026-11-26", active_ads: 2, capped: false, domains: { "shop.de": 2 }, new_ads: 2 });
    const upd = calls.find((c) => c.table === "tracked_shops" && c.op === "update");
    expect(upd?.args[0]).toMatchObject({ name: "Neuer Name", last_error: null });
  });

  it("speichert Fehler beim Shop, ohne das Token preiszugeben", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "geheim");
    const { client, calls } = fakeSupabase();
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 })) as unknown as typeof fetch;
    const res = await snapshotShop(client, { id: "s1", page_id: "123456", name: "Shop" }, f);
    expect(res.status).toBe("error");
    const upd = calls.find((c) => c.table === "tracked_shops" && c.op === "update");
    expect(JSON.stringify(upd?.args)).not.toContain("geheim");
  });
});
