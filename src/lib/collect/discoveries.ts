import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemArea = "trend_spy" | "ad_spy" | "startup_spy" | "future_radar";
export type ItemType = "product" | "brand" | "startup" | "ad" | "topic";

/** Eine neue Entdeckung eines Sammlers. Zahlen in signal kommen immer aus der Quelle, nie aus der KI. */
export type Discovery = {
  name: string;
  type: ItemType;
  area: ItemArea;
  sourceId: string;
  sourceUrl: string;
  description?: string | null;
  category?: string | null;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  signal?: { metric: string; value: number; unit?: string } | null;
  /** Startup (Produktlaunch) oder Small Business (neuer Shop / neue Firma). */
  stage?: "startup" | "small_business" | null;
  /** Start laut Quelle (Launch-Datum, älteste bekannte Anzeige). */
  launchedAt?: string | null;
  /** E-Commerce-Relevanz nach Regeln (Einschätzung) mit Begründung. */
  relevance?: { relevance: "ecommerce" | "unclear" | "excluded"; reason: string } | null;
};

/** Host einer Website ohne „www.“, sonst null. */
export function websiteHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Spalten aus Migration 0007. Fehlen sie noch, wird ohne sie gespeichert. */
const PHASE5_COLUMNS = ["stage", "launched_at", "relevance", "relevance_reason"];
const missingColumn = (message: string | undefined) => PHASE5_COLUMNS.some((c) => (message ?? "").includes(c));

export type SaveStats = { inserted: number; updated: number; failed: number; added: { id: string; name: string }[] };

/** Gleiche Normalisierung wie die Spalte items.normalized_name in der Datenbank. */
export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
}

/** Ab dieser Namensähnlichkeit (pg_trgm) im selben Bereich gilt ein Eintrag als Duplikat. */
export const DUPLICATE_SIMILARITY = 0.8;

type Candidate = { id: string; area: string; similarity: number };

/** Wählt aus den ähnlichen Einträgen ein Duplikat im selben Bereich aus, sonst null. */
export function pickDuplicate(candidates: Candidate[], area: ItemArea): string | null {
  const best = candidates
    .filter((c) => c.area === area && c.similarity >= DUPLICATE_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)[0];
  return best?.id ?? null;
}

const clip = (v: string | null | undefined, max: number) => (v ? v.replace(/\s+/g, " ").trim().slice(0, max) || null : null);

/**
 * Speichert Entdeckungen mit Duplikaterkennung:
 * 1. gleiche Originalquelle → bestehender Eintrag, nur „zuletzt gesehen“ und Signal aktualisieren;
 * 2. sehr ähnlicher Name im selben Bereich → ebenso;
 * 3. sonst neuer Eintrag mit Quelle und Entdeckungsdatum.
 */
export async function saveDiscoveries(supabase: SupabaseClient, list: Discovery[], now = new Date()): Promise<SaveStats> {
  const stats: SaveStats = { inserted: 0, updated: 0, failed: 0, added: [] };
  const seen = new Set<string>();
  for (const d of list) {
    const name = clip(d.name, 200);
    if (!name || !d.sourceUrl || seen.has(d.sourceUrl)) continue;
    seen.add(d.sourceUrl);

    let id: string | null = null;
    const bySource = await supabase.from("items").select("id").eq("source_url", d.sourceUrl).limit(1);
    if (bySource.error) {
      stats.failed++;
      continue;
    }
    id = bySource.data?.[0]?.id ?? null;
    const host = websiteHost(d.websiteUrl);
    if (!id && host) {
      // Gleiche Website im selben Bereich (z. B. Product-Hunt-Launch und Anzeigen derselben Marke).
      const byHost = await supabase.from("items").select("id").eq("area", d.area).ilike("website_url", `%${host}%`).limit(1);
      id = byHost.data?.[0]?.id ?? null;
    }
    if (!id && normalizeName(name)) {
      const similar = await supabase.rpc("find_similar_items", { q: name, max_results: 5, min_score: DUPLICATE_SIMILARITY });
      id = pickDuplicate((similar.data ?? []) as Candidate[], d.area);
    }

    if (id) {
      const { error } = await supabase.from("items").update({ last_seen_at: now.toISOString() }).eq("id", id);
      if (error) {
        stats.failed++;
        continue;
      }
      stats.updated++;
    } else {
      const row: Record<string, unknown> = {
        type: d.type,
        area: d.area,
        name,
        description: clip(d.description, 1000),
        category: clip(d.category, 100),
        website_url: clip(d.websiteUrl, 1000),
        image_url: clip(d.imageUrl, 1000),
        source_id: d.sourceId,
        source_url: d.sourceUrl,
        first_discovered_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        stage: d.stage ?? null,
        launched_at: d.launchedAt ?? null,
        relevance: d.relevance?.relevance ?? "unclear",
        relevance_reason: clip(d.relevance?.reason, 300),
      };
      const insert = (r: Record<string, unknown>) => supabase.from("items").insert(r).select("id").single();
      let { data, error } = await insert(row);
      if (error && missingColumn(error.message)) {
        for (const c of PHASE5_COLUMNS) delete row[c];
        ({ data, error } = await insert(row));
      }
      if (error || !data) {
        stats.failed++;
        continue;
      }
      id = data.id as string;
      stats.inserted++;
      stats.added.push({ id, name });
    }

    if (d.signal && Number.isFinite(d.signal.value)) {
      await supabase.from("signals").insert({
        item_id: id,
        source_id: d.sourceId,
        metric: d.signal.metric,
        value: d.signal.value,
        unit: d.signal.unit ?? null,
        observed_at: now.toISOString(),
        source_url: d.sourceUrl,
      });
    }
  }
  return stats;
}
