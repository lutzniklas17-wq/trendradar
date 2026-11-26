import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrendQuery } from "./dataforseo";

vi.mock("server-only", () => ({}));
const { getTrend, fetchExploreLive } = await import("./service");

type Call = { table: string; op: string; args: unknown[] };

/** Minimaler Supabase-Ersatz: jede Kette liefert die Antwort, die zu Tabelle und Operation passt. */
function fakeSupabase(responses: { cache?: unknown; count?: number; insert?: unknown }) {
  const calls: Call[] = [];
  const from = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = {};
    const record = (name: string) => (...args: unknown[]) => {
      if (name === "insert" || name === "update") op = name;
      if (name === "select" && (args[1] as { head?: boolean } | undefined)?.head) op = "count";
      calls.push({ table, op: name, args });
      return chain;
    };
    for (const m of ["select", "eq", "filter", "gte", "order", "limit", "maybeSingle", "single", "insert", "update"]) {
      chain[m] = record(m);
    }
    chain.then = (resolve: (v: unknown) => void) => {
      if (op === "count") return resolve({ count: responses.count ?? 0, error: null });
      if (op === "insert") return resolve({ data: responses.insert ?? { fetched_at: "2026-11-26T10:00:00Z" }, error: null });
      if (op === "update") return resolve({ data: null, error: null });
      return resolve({ data: responses.cache ?? null, error: null });
    };
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const query: TrendQuery = { keywords: ["led maske"], geo: "2756", timeRange: "past_12_months" };
const apiOk = {
  status_code: 20000,
  tasks: [
    {
      status_code: 20000,
      cost: 0.009,
      result: [{ items: [{ type: "google_trends_graph", keywords: ["led maske"], data: [{ date_from: "2026-01-01", values: [7] }] }] }],
    },
  ],
};
const okFetch = () => vi.fn(async () => new Response(JSON.stringify(apiOk), { status: 200 }));

beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "login@example.com");
  vi.stubEnv("DATAFORSEO_PASSWORD", "geheim");
  vi.stubEnv("DATAFORSEO_DAILY_LIMIT", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("fetchExploreLive", () => {
  it("sendet Basic-Auth und die Aufgabe als Array", async () => {
    const f = okFetch();
    await fetchExploreLive(query, { login: "u", password: "p" }, f);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("u:p").toString("base64")}`);
    expect(JSON.parse(init.body as string)[0]).toMatchObject({ keywords: ["led maske"], location_code: 2756 });
  });

  it("meldet falsche Zugangsdaten verständlich", async () => {
    const f = vi.fn(async () => new Response("", { status: 401 }));
    await expect(fetchExploreLive(query, { login: "u", password: "p" }, f)).rejects.toThrow(/Passwort/);
  });
});

describe("getTrend", () => {
  it("nimmt den Zwischenspeicher und ruft dann nicht ab", async () => {
    const payload = { keywords: ["led maske"], points: [], averages: [null], checkUrl: null, sourceDatetime: null, costUsd: null };
    const { client } = fakeSupabase({ cache: { payload, fetched_at: "2026-11-26T08:00:00Z" } });
    const f = okFetch();
    const r = await getTrend(client, query, f);
    expect(r).toMatchObject({ status: "ok", fromCache: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("ruft ohne Zugangsdaten nichts ab", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const f = okFetch();
    const r = await getTrend(fakeSupabase({}).client, query, f);
    expect(r.status).toBe("not_configured");
    expect(f).not.toHaveBeenCalled();
  });

  it("hält das Tageslimit ein", async () => {
    vi.stubEnv("DATAFORSEO_DAILY_LIMIT", "3");
    const f = okFetch();
    const r = await getTrend(fakeSupabase({ count: 3 }).client, query, f);
    expect(r).toEqual({ status: "limit_reached", limit: 3 });
    expect(f).not.toHaveBeenCalled();
  });

  it("ruft live ab und speichert das Ergebnis", async () => {
    const { client, calls } = fakeSupabase({ count: 0 });
    const r = await getTrend(client, query, okFetch());
    expect(r).toMatchObject({ status: "ok", fromCache: false });
    const insert = calls.find((c) => c.table === "trend_series" && c.op === "insert");
    expect(insert?.args[0]).toMatchObject({ keywords: ["led maske"], geo: "2756", source_id: "dataforseo_trends" });
  });

  it("gibt API-Fehler weiter und merkt sie bei der Quelle", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ status_code: 40200, status_message: "Payment Required." }), { status: 200 }));
    const { client, calls } = fakeSupabase({ count: 0 });
    const r = await getTrend(client, query, f);
    expect(r).toEqual({ status: "error", message: "Payment Required." });
    expect(calls.some((c) => c.table === "sources" && c.op === "update")).toBe(true);
  });
});
