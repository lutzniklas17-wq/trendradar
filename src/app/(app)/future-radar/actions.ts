"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { parseTopic } from "@/lib/radar/assess";

// Server Actions sind öffentlich erreichbare Endpunkte: jede prüft selbst die Sitzung und alle Eingaben.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = "/future-radar";
const back = (message: string): never => redirect(`${PATH}?hinweis=${encodeURIComponent(message)}`);
const field = (form: FormData, key: string, max: number) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

export async function addRadarTopic(form: FormData) {
  const { supabase } = await requireOwner();
  const term = parseTopic(field(form, "thema", 100));
  if (!term) back("Bitte ein Thema mit 2 bis 60 Zeichen eingeben.");
  const note = field(form, "notiz", 300) || null;
  const { error } = await supabase.from("radar_topics").insert({ term, note });
  if (error) back(error.code === "23505" ? `„${term}“ wird schon beobachtet.` : "Thema konnte nicht gespeichert werden. Ist die Migration 0007 gelaufen?");
  revalidatePath(PATH);
  back(`„${term}“ wird ab jetzt beobachtet.`);
}

export async function removeRadarTopic(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiges Thema.");
  await supabase.from("radar_topics").delete().eq("id", id);
  revalidatePath(PATH);
  back("Thema entfernt.");
}
