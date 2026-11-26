import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName, pickDuplicate, saveDiscoveries, type Discovery } from "./discoveries";

/** Minimaler Supabase-Ersatz: items-Abfrage nach source_url, find_similar_items, insert/update. */
function fake({ bySource = [] as { id: string }[], similar = [] as unknown[] } = {}) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const from = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "limit", "insert", "update", "single"]) {
      chain[m] = (...args: unknown[]) => {
        if (m === "insert" || m === "update") op = m;
        calls.push({ table, op: m, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => void) => {
      if (table === "items" && op === "select") return resolve({ data: bySource, error: null });
      if (table === "items" && op === "insert") return resolve({ data: { id: "neu-1" }, error: null });
      return resolve({ data: null, error: null });
    };
    return chain;
  };
  const rpc = async (...args: unknown[]) => {
    calls.push({ table: "rpc", op: "rpc", args });
    return { data: similar, error: null };
  };
  return { client: { from, rpc } as unknown as SupabaseClient, calls };
}

const d: Discovery = {
  name: "Glow Mask",
  type: "startup",
  area: "startup_spy",
  sourceId: "product_hunt",
  sourceUrl: "https://www.producthunt.com/posts/glow",
  signal: { metric: "producthunt_votes", value: 10 },
};

describe("Duplikaterkennung", () => {
  it("normalizeName entfernt Sonderzeichen", () => {
    expect(normalizeName("  Glow-Mask™ Pro! ")).toBe("glowmask pro");
  });

  it("pickDuplicate nimmt nur sehr ähnliche Einträge im selben Bereich", () => {
    const c = [
      { id: "a", area: "trend_spy", similarity: 0.95 },
      { id: "b", area: "startup_spy", similarity: 0.85 },
      { id: "c", area: "startup_spy", similarity: 0.5 },
    ];
    expect(pickDuplicate(c, "startup_spy")).toBe("b");
    expect(pickDuplicate(c, "future_radar")).toBeNull();
  });

  it("legt Neues mit Quelle und Entdeckungsdatum an und speichert das Signal", async () => {
    const { client, calls } = fake();
    const stats = await saveDiscoveries(client, [d, d], new Date("2026-11-26T05:00:00Z"));
    expect(stats).toEqual({ inserted: 1, updated: 0, failed: 0, added: [{ id: "neu-1", name: "Glow Mask" }] });
    const insert = calls.find((c) => c.table === "items" && c.op === "insert");
    expect(insert?.args[0]).toMatchObject({ source_url: d.sourceUrl, source_id: "product_hunt", first_discovered_at: "2026-11-26T05:00:00.000Z" });
    expect(calls.some((c) => c.table === "signals" && c.op === "insert")).toBe(true);
  });

  it("gleiche Quelle: nur aktualisieren, nichts Neues anlegen", async () => {
    const { client, calls } = fake({ bySource: [{ id: "alt" }] });
    const stats = await saveDiscoveries(client, [d]);
    expect(stats).toMatchObject({ inserted: 0, updated: 1, failed: 0 });
    expect(calls.some((c) => c.table === "items" && c.op === "insert")).toBe(false);
    expect(calls.some((c) => c.table === "rpc")).toBe(false);
  });

  it("sehr ähnlicher Name im selben Bereich: zusammenführen", async () => {
    const { client } = fake({ similar: [{ id: "x", area: "startup_spy", similarity: 0.9 }] });
    expect(await saveDiscoveries(client, [d])).toMatchObject({ inserted: 0, updated: 1, failed: 0 });
  });
});
