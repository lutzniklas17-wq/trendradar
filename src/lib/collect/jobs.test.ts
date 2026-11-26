import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const { runAdSweep, runProductHunt, sweepTerm } = await import("./jobs");

function fake(terms: unknown[] = []) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const from = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "upsert", "update", "insert", "order", "limit", "delete", "lt"]) {
      chain[m] = (...args: unknown[]) => {
        if (["upsert", "update", "insert"].includes(m)) op = m;
        calls.push({ table, op: m, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => void) => {
      if (table === "advertisers") return resolve({ data: [{ id: "adv-1", external_id: "9" }], error: null });
      if (table === "ads" && op === "upsert") return resolve({ data: [{ id: "uuid-1", external_id: "1" }, { id: "uuid-2", external_id: "2" }], error: null });
      if (table === "ad_watch_terms" && op === "select") return resolve({ data: terms, error: null });
      if (table === "ad_term_hits" && op === "select") return resolve({ data: [{ ad_id: "uuid-old" }, { ad_id: "uuid-1" }], error: null });
      if (table === "ad_sightings" && op === "select") return resolve({ data: [{ ad_id: "uuid-old" }], error: null });
      return resolve({ data: null, error: null });
    };
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const metaPage = { data: [{ id: "1", page_id: "9", page_name: "Glow" }, { id: "2", page_id: "9" }], paging: { cursors: {} } };
const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

afterEach(() => vi.unstubAllEnvs());

describe("Anzeigen-Sammellauf", () => {
  it("sweepTerm fragt aktive Anzeigen mit 100 pro Seite ab und speichert Sichtung und Stichwort", async () => {
    const { client, calls } = fake();
    const f = okFetch(metaPage);
    const res = await sweepTerm(client, { id: "t1", term: "led maske", country: "DE" }, { accessToken: "TOK" }, f, new Date("2026-11-26T05:00:00Z"));
    expect(res).toEqual({ count: 2, capped: false, newAds: 2, newAdvertisers: [], ended: null, firstRun: true });
    const url = new URL(String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]));
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("ad_active_status")).toBe("ACTIVE");
    const sight = calls.find((c) => c.table === "ad_sightings" && c.op === "upsert");
    expect(sight?.args[0]).toEqual([
      { ad_id: "uuid-1", day: "2026-11-26", country: "DE" },
      { ad_id: "uuid-2", day: "2026-11-26", country: "DE" },
    ]);
    const hits = calls.find((c) => c.table === "ad_term_hits" && c.op === "upsert");
    expect(hits?.args[0]).toEqual([{ ad_id: "uuid-1", term_id: "t1" }, { ad_id: "uuid-2", term_id: "t1" }]);
    expect(JSON.stringify(calls)).not.toContain("TOK");
  });

  it("erkennt beim Folgelauf Anzeigen, die nicht mehr aktiv sind", async () => {
    const { client, calls } = fake();
    const res = await sweepTerm(
      client,
      { id: "t1", term: "led maske", country: "DE", last_run_at: "2026-11-25T05:00:00Z" },
      { accessToken: "TOK" },
      okFetch(metaPage),
      new Date("2026-11-26T05:00:00Z"),
    );
    expect(res).toMatchObject({ ended: 1, firstRun: false });
    const prev = calls.filter((c) => c.table === "ad_sightings" && c.op === "eq").map((c) => c.args);
    expect(prev).toEqual([["day", "2026-11-25"], ["country", "DE"]]);
  });

  it("ohne Token: übersprungen", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    expect((await runAdSweep(fake().client)).status).toBe("skipped");
  });

  it("überspringt Stichwörter, die heute schon dran waren, und protokolliert den Lauf", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "TOK");
    const now = new Date("2026-11-26T05:00:00Z");
    const { client, calls } = fake([
      { id: "t1", term: "a", country: "DE", last_run_at: null },
      { id: "t2", term: "b", country: "DE", last_run_at: "2026-11-26T04:00:00Z" },
    ]);
    const f = okFetch(metaPage);
    const res = await runAdSweep(client, { fetchImpl: f, now });
    expect(f).toHaveBeenCalledTimes(1);
    expect(res.status).toBe("success");
    expect(calls.some((c) => c.table === "research_runs" && c.op === "insert")).toBe(true);
  });

  it("bricht bei abgelaufenem Token ab", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "TOK");
    const { client } = fake([
      { id: "t1", term: "a", country: "DE", last_run_at: null },
      { id: "t2", term: "b", country: "DE", last_run_at: null },
    ]);
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 })) as unknown as typeof fetch;
    const res = await runAdSweep(client, { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(res.status).toBe("failed");
    expect(res.message).toMatch(/abgelaufen/);
  });
});

describe("Product-Hunt-Lauf", () => {
  it("ohne Token: übersprungen", async () => {
    vi.stubEnv("PRODUCTHUNT_TOKEN", "");
    expect((await runProductHunt(fake().client)).status).toBe("skipped");
  });
});
