"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { parsePageInput } from "@/lib/shops/shops";
import { snapshotDueShops, snapshotShop } from "@/lib/shops/service";

// Server Actions sind öffentlich erreichbare Endpunkte: jede prüft selbst die Sitzung und alle Eingaben.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const field = (form: FormData, key: string, max: number) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

const backWithError = (message: string): never => redirect(`/shop-spy?fehler=${encodeURIComponent(message)}`);

/** Shop verfolgen (aus dem Formular oder aus dem Ad Spy) und sofort zum ersten Mal zählen. */
export async function trackShop(form: FormData) {
  const { supabase } = await requireOwner();
  const parsed = parsePageInput(field(form, "seite", 500));
  if (!parsed.ok) return backWithError(parsed.error);
  const name = field(form, "name", 200) || `Seite ${parsed.pageId}`;

  const { data: existing } = await supabase.from("tracked_shops").select("id").eq("platform", "meta").eq("page_id", parsed.pageId).maybeSingle();
  if (existing) redirect(`/shop-spy/${existing.id}`);

  const { data: shop, error } = await supabase
    .from("tracked_shops")
    .insert({ platform: "meta", page_id: parsed.pageId, name })
    .select("id, page_id, name")
    .single();
  if (error || !shop) return backWithError("Shop konnte nicht gespeichert werden. Ist die Migration 0003 in Supabase gelaufen?");

  await snapshotShop(supabase, shop);
  revalidatePath("/shop-spy");
  redirect(`/shop-spy/${shop.id}`);
}

/** Einen Shop jetzt neu zählen. */
export async function refreshShop(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) return backWithError("Ungültiger Shop.");
  const { data: shop } = await supabase.from("tracked_shops").select("id, page_id, name").eq("id", id).maybeSingle();
  if (!shop) return backWithError("Shop nicht gefunden.");
  await snapshotShop(supabase, shop);
  revalidatePath("/shop-spy");
  revalidatePath(`/shop-spy/${id}`);
}

/** Alle Shops zählen, die heute noch nicht gezählt wurden. */
export async function refreshAllShops() {
  const { supabase } = await requireOwner();
  const res = await snapshotDueShops(supabase, { max: 15 });
  revalidatePath("/shop-spy");
  if (res.error) backWithError(res.error);
  if (res.remaining > 0) backWithError(`${res.checked} Shops gezählt, ${res.remaining} noch offen. Bitte nochmals klicken.`);
}

/** Shop nicht mehr verfolgen (Verlauf wird mit gelöscht). */
export async function removeShop(form: FormData) {
  const { supabase } = await requireOwner();
  const id = field(form, "id", 40);
  if (!UUID.test(id)) return backWithError("Ungültiger Shop.");
  await supabase.from("tracked_shops").delete().eq("id", id);
  revalidatePath("/shop-spy");
  redirect("/shop-spy");
}
