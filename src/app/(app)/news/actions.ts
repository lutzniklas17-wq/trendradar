"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { runNews } from "@/lib/collect/jobs";
import { parseKeywords } from "@/lib/collect/rss";
import { NEWS_SUGGESTIONS } from "@/lib/news";

// Server Actions sind öffentlich erreichbare Endpunkte: jede prüft selbst die Sitzung und alle Eingaben.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (form: FormData, key: string, max: number) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};
const back = (message: string): never => redirect(`/news?hinweis=${encodeURIComponent(message)}`);

export async function addNewsFeed(form: FormData) {
  const { supabase } = await requireOwner();
  const suggestion = NEWS_SUGGESTIONS.find((s) => s.id === field(form, "vorschlag", 40));
  let url = suggestion?.url ?? field(form, "url", 1000);
  let name = suggestion?.name ?? field(form, "name", 100);
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") back("Nur https-Feeds.");
    url = u.toString();
    name = name || u.hostname;
  } catch {
    back("Bitte eine gültige Feed-Adresse eingeben.");
  }
  const { error } = await supabase
    .from("feeds")
    .upsert({ url, name, kind: "news", area: "future_radar", keywords: parseKeywords(field(form, "stichwoerter", 2000)), active: true }, { onConflict: "url" });
  if (error) back("Feed konnte nicht gespeichert werden. Sind die Migrationen 0004 und 0006 in Supabase gelaufen?");
  revalidatePath("/news");
  back(`„${name}“ wird ab jetzt täglich gelesen. Mit „Jetzt aktualisieren“ sofort laden.`);
}

export async function removeNewsFeed(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiger Feed.");
  await supabase.from("feeds").delete().eq("id", id);
  revalidatePath("/news");
}

export async function refreshNews() {
  const { supabase } = await requireOwner();
  const res = await runNews(supabase);
  revalidatePath("/news");
  back(res.message);
}
