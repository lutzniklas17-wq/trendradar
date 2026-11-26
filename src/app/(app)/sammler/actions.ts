"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { EU_COUNTRIES, normalizeTerms, validateTerms } from "@/lib/ads/meta";
import { isJob, runJob } from "@/lib/collect/jobs";
import { parseKeywords } from "@/lib/collect/rss";

// Server Actions sind öffentlich erreichbare Endpunkte: jede prüft selbst die Sitzung und alle Eingaben.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AREAS = ["trend_spy", "startup_spy", "future_radar"] as const;

const field = (form: FormData, key: string, max: number) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

const back = (message: string, path = "/sammler"): never => redirect(`${path}?hinweis=${encodeURIComponent(message)}`);

/** Stichwort für den täglichen Anzeigen-Sammellauf hinzufügen (auch aus dem Ad Spy und von der Produktseite). */
export async function addWatchTerm(form: FormData) {
  const { supabase } = await requireOwner();
  const term = normalizeTerms(field(form, "begriff", 200));
  const country = field(form, "land", 2).toUpperCase();
  const itemId = field(form, "item", 40);
  const returnTo = field(form, "zurueck", 300);
  const path = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/sammler";
  const invalid = validateTerms(term);
  if (invalid) back(invalid, path);
  if (!(EU_COUNTRIES as readonly string[]).includes(country)) back("Bitte ein EU-Land wählen.", path);

  const { error } = await supabase
    .from("ad_watch_terms")
    .upsert({ term, country, active: true, ...(UUID.test(itemId) ? { item_id: itemId } : {}) }, { onConflict: "term,country" });
  if (error) back("Stichwort konnte nicht gespeichert werden. Ist die Migration 0004 in Supabase gelaufen?", path);
  revalidatePath("/sammler");
  back(`„${term}“ (${country}) wird ab jetzt täglich gesammelt.`, path);
}

export async function toggleWatchTerm(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiges Stichwort.");
  await supabase.from("ad_watch_terms").update({ active: field(form, "aktiv", 5) === "1" }).eq("id", id);
  revalidatePath("/sammler");
}

export async function removeWatchTerm(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiges Stichwort.");
  await supabase.from("ad_watch_terms").delete().eq("id", id);
  revalidatePath("/sammler");
}

export async function addFeed(form: FormData) {
  const { supabase } = await requireOwner();
  const url = field(form, "url", 1000);
  const name = field(form, "name", 100);
  const area = field(form, "bereich", 20);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return back("Bitte eine gültige Feed-Adresse eingeben.");
  }
  if (parsed.protocol !== "https:") back("Nur https-Feeds.");
  if (!(AREAS as readonly string[]).includes(area)) back("Ungültiger Bereich.");
  const { error } = await supabase.from("feeds").upsert(
    { url: parsed.toString(), name: name || parsed.hostname, area, keywords: parseKeywords(field(form, "stichwoerter", 2000)), active: true },
    { onConflict: "url" },
  );
  if (error) back("Feed konnte nicht gespeichert werden. Ist die Migration 0004 in Supabase gelaufen?");
  revalidatePath("/sammler");
}

export async function removeFeed(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiger Feed.");
  await supabase.from("feeds").delete().eq("id", id);
  revalidatePath("/sammler");
}

/** Einen Sammler sofort ausführen (gleiche Logik wie der tägliche Lauf, aber mit deiner Sitzung). */
export async function runCollectorNow(form: FormData) {
  const { supabase } = await requireOwner();
  const job = field(form, "job", 20);
  if (!isJob(job)) back("Unbekannter Sammler.");
  const res = await runJob(supabase, job as Parameters<typeof runJob>[1], { max: 10 });
  revalidatePath("/sammler");
  back(res.message);
}
