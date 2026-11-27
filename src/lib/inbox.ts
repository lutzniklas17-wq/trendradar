import type { SupabaseClient } from "@supabase/supabase-js";

export type ChangeKind = "added" | "changed" | "removed";
export type Change = { kind: ChangeKind; label: string; detail?: string; href?: string; favorite?: boolean };

/** Höchstens so viele Änderungen pro Inbox-Eintrag; der Rest wird zusammengefasst. */
export const MAX_CHANGES = 60;

/** Kürzt die Liste und hängt eine Zusammenfassung an. Favoriten bleiben immer drin und stehen vorne. */
export function compactChanges(changes: Change[], max = MAX_CHANGES): Change[] {
  const sorted = [...changes.filter((c) => c.favorite), ...changes.filter((c) => !c.favorite)];
  if (sorted.length <= max) return sorted;
  const kept = sorted.slice(0, max - 1);
  return [...kept, { kind: "added", label: `… und ${sorted.length - kept.length} weitere Änderungen` }];
}

/**
 * Schreibt einen Inbox-Eintrag, aber nur wenn es wirklich Änderungen gibt.
 * Fehler (z. B. fehlende Migration 0006) stoppen den Lauf nicht.
 */
export async function addInboxEntry(supabase: SupabaseClient, job: string, title: string, changes: Change[]) {
  if (!changes.length) return false;
  const { error } = await supabase.from("inbox_entries").insert({ job, title: title.slice(0, 200), changes: compactChanges(changes) });
  return !error;
}

/**
 * Ist eine Veränderung der aktiven Anzeigen eines Shops meldenswert?
 * Favoriten: jede Veränderung. Sonst: mindestens 3 Anzeigen und 25 % Unterschied, oder auf 0 gefallen.
 */
export function shopChange(prev: number | null, now: number, favorite: boolean): Change["kind"] | null {
  if (prev === null) return null;
  if (prev === now) return null;
  if (prev > 0 && now === 0) return "removed";
  if (favorite) return "changed";
  const diff = Math.abs(now - prev);
  return diff >= 3 && diff >= prev * 0.25 ? "changed" : null;
}

/** Zählt die Änderungen aller Einträge nach Art (für die Kennzahlen oben in der Inbox). */
export function countChanges(entries: { changes: Change[] }[]): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0 };
  for (const e of entries) for (const c of e.changes) counts[c.kind] += 1;
  return counts;
}
