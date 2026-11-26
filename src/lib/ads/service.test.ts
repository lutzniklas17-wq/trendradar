import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdQuery } from "./meta";

vi.mock("server-only", () => ({}));
const { searchAds } = await import("./service");

const query: AdQuery = { terms: "led maske", country: "DE", status: "ACTIVE", platform: "", searchType: "KEYWORD_UNORDERED" };

function fakeSupabase(fail = false) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const from = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "upsert", "update"]) {
      chain[m] = (...args: unknown[]) => {
        if (m === "upsert" || m === "update") op = m;
        calls.push({ table, op: m, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => void) => {
      if (fail && op === "upsert") return resolve({ data: null, error: { message: "nein" } });
      if (table === "advertisers") return resolve({ data: [{ id: "uuid-a", external_id: "9" }], error: null });
      return resolve({ data: null, error: null });
    };
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const okFetch = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

afterEach(() => vi.unstubAllEnvs());

describe("searchAds", () => {
  it("ohne Token: nicht konfiguriert, kein Abruf", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    const f = okFetch({ data: [] });
    const { client } = fakeSupabase();
    expect(await searchAds(client, query, f)).toEqual({ status: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("ruft Meta mit Token ab und speichert Anzeigen ohne Token", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "TOKEN123");
    const f = okFetch({ data: [{ id: "1", page_id: "9", page_name: "Glow", ad_creative_bodies: ["Text"] }] });
    const { client, calls } = fakeSupabase();
    const res = await searchAds(client, query, f);
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.saved).toBe(true);
    const calledUrl = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(calledUrl).toContain("access_token=TOKEN123");
    const adsUpsert = calls.find((c) => c.table === "ads" && c.op === "upsert");
    expect(JSON.stringify(adsUpsert?.args)).toContain("uuid-a");
    expect(JSON.stringify(calls)).not.toContain("TOKEN123");
  });

  it("meldet Fehler von Meta verständlich", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "TOKEN123");
    const f = okFetch({ error: { code: 190, message: "expired" } }, 400);
    const { client, calls } = fakeSupabase();
    const res = await searchAds(client, query, f);
    expect(res).toEqual({ status: "error", message: expect.stringMatching(/abgelaufen/) });
    expect(calls.some((c) => c.table === "sources" && c.op === "update")).toBe(true);
  });

  it("zeigt Treffer auch, wenn das Speichern scheitert", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "TOKEN123");
    const { client } = fakeSupabase(true);
    const res = await searchAds(client, query, okFetch({ data: [{ id: "1", page_id: "9" }] }));
    expect(res.status === "ok" && res.saved === false && res.result.ads.length === 1).toBe(true);
  });
});
