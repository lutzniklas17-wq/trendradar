"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { parseOfferForm, type MatchStatus } from "@/lib/offers";
import { EMPTY_INPUTS, type ProfitInputs } from "@/lib/profit";
import type { CalculatorSnapshot } from "@/components/profit/profit-calculator";

// Server Actions sind öffentlich erreichbare Endpunkte: jede prüft selbst die Sitzung und alle Eingaben.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Ab dieser Namensähnlichkeit (0–1) gilt ein bestehender Eintrag als mögliches Duplikat. */
const DUPLICATE_THRESHOLD = 0.6;

export type CreateProductState = {
  error?: string;
  /** Eingaben zurückgeben, damit das Formular nach einer Rückfrage nicht leer ist */
  values?: Record<"name" | "category" | "source_url" | "description", string>;
  duplicates?: { id: string; name: string; similarity: number }[];
};

function text(form: FormData, key: string, max: number) {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

function httpsUrl(raw: string | null) {
  if (!raw) return { ok: true as const, value: null };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false as const };
    return { ok: true as const, value: url.toString() };
  } catch {
    return { ok: false as const };
  }
}

export async function createProduct(_prev: CreateProductState, form: FormData): Promise<CreateProductState> {
  const { supabase } = await requireOwner();

  const values = {
    name: text(form, "name", 200) ?? "",
    category: text(form, "category", 100) ?? "",
    source_url: text(form, "source_url", 2000) ?? "",
    description: text(form, "description", 2000) ?? "",
  };
  const name = values.name || null;
  if (!name || name.length < 2) return { error: "Bitte einen Produktnamen angeben.", values };
  const source = httpsUrl(values.source_url || null);
  if (!source.ok) return { error: "Die Quelle muss ein gültiger Link sein (https://…).", values };

  if (form.get("confirm_duplicate") !== "1") {
    const { data: similar, error } = await supabase.rpc("find_similar_items", {
      q: name,
      max_results: 5,
      min_score: DUPLICATE_THRESHOLD,
    });
    if (error) return { error: "Duplikatprüfung fehlgeschlagen. Ist Migration 0002 ausgeführt?", values };
    const duplicates = ((similar ?? []) as { id: string; name: string; similarity: number }[]).filter(
      (s) => s.similarity >= DUPLICATE_THRESHOLD,
    );
    if (duplicates.length) return { duplicates, values };
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      type: "product",
      area: "trend_spy",
      name,
      category: values.category || null,
      description: values.description || null,
      source_id: "manual",
      source_url: source.value,
      is_new: false,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Speichern fehlgeschlagen.", values };

  revalidatePath("/trend-spy");
  redirect(`/produkt/${data.id}`);
}

export type OfferFormState = { error?: string; ok?: boolean };

export async function addOffer(itemId: string, _prev: OfferFormState, form: FormData): Promise<OfferFormState> {
  if (!isUuid(itemId)) return { error: "Ungültiges Produkt." };
  const { supabase } = await requireOwner();
  const parsed = parseOfferForm(form);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("product_offers").insert({
    ...parsed.offer,
    item_id: itemId,
    is_search_link: false,
    // Du hast das Angebot selbst geprüft und eingetragen.
    match_status: "confirmed",
    data_origin: "manual",
  });
  if (error) return { error: "Speichern fehlgeschlagen." };
  revalidatePath(`/produkt/${itemId}`);
  return { ok: true };
}

const STATUSES: MatchStatus[] = ["candidate", "confirmed", "rejected"];

export async function setOfferStatus(form: FormData) {
  const itemId = form.get("item_id");
  const offerId = form.get("offer_id");
  const status = form.get("status");
  if (!isUuid(itemId) || !isUuid(offerId) || !STATUSES.includes(status as MatchStatus)) return;
  const { supabase } = await requireOwner();
  await supabase
    .from("product_offers")
    .update({ match_status: status, updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("item_id", itemId);
  revalidatePath(`/produkt/${itemId}`);
}

export async function deleteOffer(form: FormData) {
  const itemId = form.get("item_id");
  const offerId = form.get("offer_id");
  if (!isUuid(itemId) || !isUuid(offerId)) return;
  const { supabase } = await requireOwner();
  await supabase.from("product_offers").delete().eq("id", offerId).eq("item_id", itemId);
  revalidatePath(`/produkt/${itemId}`);
}

export async function toggleWatchlist(form: FormData) {
  const itemId = form.get("item_id");
  if (!isUuid(itemId)) return;
  const { supabase } = await requireOwner();
  if (form.get("watching") === "1") {
    await supabase.from("watchlist").delete().eq("item_id", itemId);
  } else {
    await supabase.from("watchlist").upsert({ item_id: itemId });
  }
  revalidatePath(`/produkt/${itemId}`);
  revalidatePath("/watchlist");
}

const PROFIT_KEYS = Object.keys(EMPTY_INPUTS) as (keyof ProfitInputs)[];
const SCENARIO_KEYS = ["conservative", "realistic", "optimistic"] as const;
const OVERRIDE_KEYS = ["sellingPrice", "adCostPerOrder", "refundRatePercent"] as const;

const cleanNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e9 ? v : null);

export async function saveCalculation(itemId: string, snapshot: CalculatorSnapshot) {
  if (!isUuid(itemId)) return { ok: false, error: "Ungültiges Produkt." };
  const { supabase } = await requireOwner();

  // Nur bekannte Felder mit endlichen Zahlen übernehmen.
  const inputs = Object.fromEntries(PROFIT_KEYS.map((k) => [k, cleanNumber(snapshot?.inputs?.[k])]));
  const scenarios = Object.fromEntries(
    SCENARIO_KEYS.map((s) => [
      s,
      Object.fromEntries(
        OVERRIDE_KEYS.map((k) => [k, cleanNumber(snapshot?.scenarios?.[s]?.[k])]).filter(([, v]) => v != null),
      ),
    ]),
  );
  const currency = ["CHF", "EUR", "USD"].includes(snapshot?.currency) ? snapshot.currency : "CHF";

  const { error } = await supabase
    .from("profit_scenarios")
    .upsert({ item_id: itemId, inputs, scenarios, currency, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  return { ok: true };
}
