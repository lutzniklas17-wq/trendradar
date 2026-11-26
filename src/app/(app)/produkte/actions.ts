"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { connectedPlatforms, saveProducts, searchPlatform } from "@/lib/library/service";
import { isLibraryPlatform, librarySource, SupplierError, type LibraryPlatform } from "@/lib/library/sources";
import { runLibrary } from "@/lib/collect/jobs";

// Server Actions sind öffentlich erreichbare Endpunkte: jede prüft selbst die Sitzung und alle Eingaben.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRIES = ["", "DE", "FR", "GB", "US", "CN"];

function field(form: FormData, key: string, max: number) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function back(hinweis: string, extra: Record<string, string> = {}): never {
  redirect(`/produkte?${new URLSearchParams({ ...extra, hinweis })}`);
}

/** Live-Suche bei einer oder allen verbundenen Plattformen: speichert die Treffer in der Bibliothek und zeigt sie an. */
export async function searchLibrary(form: FormData) {
  const { supabase } = await requireOwner();
  const term = field(form, "begriff", 80).toLowerCase();
  const country = field(form, "lager", 2).toUpperCase();
  const wanted = field(form, "plattform", 20);
  const follow = form.get("taeglich") === "1";
  if (term.length < 2) back("Bitte einen Suchbegriff mit mindestens 2 Zeichen eingeben.");
  const connected = connectedPlatforms();
  const platforms: LibraryPlatform[] = isLibraryPlatform(wanted) ? [wanted] : connected;
  if (!platforms.length) back("Keine Plattform verbunden. Zuerst CJ_API_KEY (oder die AliExpress-Schlüssel) in Vercel eintragen.");
  const missing = platforms.filter((p) => !connected.includes(p));
  if (missing.length) back(`${librarySource(missing[0])?.name} ist noch nicht verbunden: Schlüssel fehlen in Vercel.`);

  const parts: string[] = [];
  const errors: string[] = [];
  for (const platform of platforms) {
    const name = librarySource(platform)?.name ?? platform;
    try {
      const page = await searchPlatform(supabase, platform, { keyword: term, country: COUNTRIES.includes(country) && country ? country : undefined });
      const r = await saveProducts(supabase, platform, page.products, term);
      const sourceId = librarySource(platform)?.sourceId;
      if (sourceId) await supabase.from("sources").update({ last_success_at: new Date().toISOString() }).eq("id", sourceId);
      parts.push(`${name}: ${page.products.length} Treffer (${r.added} neu)`);
    } catch (e) {
      console.error(`Suche bei ${name} fehlgeschlagen`, e);
      errors.push(e instanceof SupplierError ? `${name}: ${e.message}` : `${name}: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannter Fehler"}`);
    }
  }
  if (!parts.length) back(errors.join(" ") || "Suche fehlgeschlagen.");
  let message = `${parts.join(", ")}.` + (errors.length ? ` Fehler bei ${errors.join(" ")}` : "");
  if (follow) {
    await supabase.from("library_terms").upsert({ term, active: true }, { onConflict: "term" });
    message += " Der Begriff wird ab jetzt täglich aktualisiert.";
  }
  revalidatePath("/produkte");
  back(message, platforms.length === 1 ? { begriff: term, plattform: platforms[0] } : { begriff: term });
}

export async function addLibraryTerm(form: FormData) {
  const { supabase } = await requireOwner();
  const term = field(form, "begriff", 80).toLowerCase();
  if (term.length < 2) back("Bitte einen Suchbegriff mit mindestens 2 Zeichen eingeben.");
  const { error } = await supabase.from("library_terms").upsert({ term, active: true }, { onConflict: "term" });
  if (error) back("Begriff konnte nicht gespeichert werden. Ist die Migration 0008 gelaufen?");
  revalidatePath("/produkte");
  back(`„${term}“ wird ab jetzt täglich bei CJ gesucht.`);
}

export async function removeLibraryTerm(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiger Begriff.");
  await supabase.from("library_terms").delete().eq("id", id);
  revalidatePath("/produkte");
}

/** Produkt aus- oder wieder einblenden. */
export async function toggleHidden(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiges Produkt.");
  const hide = form.get("hide") === "1";
  await supabase.from("supplier_products").update({ hidden: hide }).eq("id", id);
  revalidatePath("/produkte");
}

/** Übernimmt ein Bibliotheks-Produkt als eigenes Produkt (Trend Spy) samt Lieferanten-Angebot und öffnet die Produktseite. */
export async function adoptProduct(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) back("Ungültiges Produkt.");
  const { data: p } = await supabase
    .from("supplier_products")
    .select("id, platform, title, image_url, price, currency, category, product_url, item_id, listed_count")
    .eq("id", id)
    .maybeSingle();
  if (!p) back("Produkt nicht gefunden.");
  if (p.item_id) redirect(`/produkt/${p.item_id}`);
  const source = librarySource(p.platform);
  const sourceName = source?.name ?? p.platform;

  const { data: item, error } = await supabase
    .from("items")
    .insert({
      type: "product",
      area: "trend_spy",
      name: p.title.slice(0, 200),
      category: p.category,
      image_url: p.image_url,
      source_id: source?.sourceId ?? null,
      source_url: p.product_url,
      description:
        p.listed_count !== null && source
          ? `Aus der Produkt-Bibliothek (${sourceName}, ${p.listed_count}× ${source.popularity}).`
          : `Aus der Produkt-Bibliothek (${sourceName}).`,
    })
    .select("id")
    .single();
  if (error || !item) back("Produkt konnte nicht angelegt werden.");

  await supabase.from("product_offers").insert({
    item_id: item.id,
    platform: p.platform,
    role: "supplier",
    url: p.product_url,
    // CJ: Link ist eine Suche nach der SKU; AliExpress: direkte Produktseite
    is_search_link: p.platform === "cj",
    match_status: "confirmed",
    price: p.price,
    currency: p.currency,
    title: p.title.slice(0, 300),
    data_origin: "api",
  });
  await supabase.from("supplier_products").update({ item_id: item.id }).eq("id", p.id);
  revalidatePath("/produkte");
  redirect(`/produkt/${item.id}`);
}

/** Täglichen Bibliothekslauf sofort starten (gleiche Logik wie Vercel Cron). */
export async function runLibraryNow() {
  const { supabase } = await requireOwner();
  const r = await runLibrary(supabase);
  revalidatePath("/produkte");
  back(r.message);
}
