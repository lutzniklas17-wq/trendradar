import { getSupplierPlatform, isPlatformUrl } from "@/lib/platforms";
import type { ProfitInputs } from "@/lib/profit";

export type MatchStatus = "candidate" | "confirmed" | "rejected";

export type Offer = {
  id: string;
  platform: string;
  role: "supplier" | "price_reference";
  url: string;
  title: string | null;
  isSearchLink: boolean;
  matchStatus: MatchStatus;
  price: number | null;
  currency: string | null;
  shippingCost: number | null;
  shippingDays: string | null;
  destinationCountry: string | null;
  moq: number | null;
  supplierRating: number | null;
  dataOrigin: "api" | "manual";
  note: string | null;
  fetchedAt: string;
  updatedAt: string;
};

export type OfferRow = {
  id: string;
  platform: string;
  role: "supplier" | "price_reference";
  url: string;
  title: string | null;
  is_search_link: boolean;
  match_status: MatchStatus;
  price: number | string | null;
  currency: string | null;
  shipping_cost: number | string | null;
  shipping_days: string | null;
  destination_country: string | null;
  moq: number | null;
  supplier_rating: number | string | null;
  data_origin: "api" | "manual";
  note: string | null;
  fetched_at: string;
  updated_at: string;
};

export const OFFER_COLUMNS =
  "id, platform, role, url, title, is_search_link, match_status, price, currency, shipping_cost, shipping_days, destination_country, moq, supplier_rating, data_origin, note, fetched_at, updated_at";

const num = (v: number | string | null) => (v == null ? null : Number(v));

export function fromRow(r: OfferRow): Offer {
  return {
    id: r.id,
    platform: r.platform,
    role: r.role,
    url: r.url,
    title: r.title,
    isSearchLink: r.is_search_link,
    matchStatus: r.match_status,
    price: num(r.price),
    currency: r.currency,
    shippingCost: num(r.shipping_cost),
    shippingDays: r.shipping_days,
    destinationCountry: r.destination_country,
    moq: r.moq,
    supplierRating: num(r.supplier_rating),
    dataOrigin: r.data_origin,
    note: r.note,
    fetchedAt: r.fetched_at,
    updatedAt: r.updated_at,
  };
}

export const CURRENCIES = ["CHF", "EUR", "USD"] as const;

export type OfferInput = {
  platform: string;
  role: "supplier" | "price_reference";
  url: string;
  title: string | null;
  price: number | null;
  currency: (typeof CURRENCIES)[number];
  shipping_cost: number | null;
  shipping_days: string | null;
  destination_country: string | null;
  moq: number | null;
  supplier_rating: number | null;
  note: string | null;
};

function optionalNumber(value: FormDataEntryValue | null, { min = 0, max = Infinity, integer = false } = {}) {
  if (typeof value !== "string" || value.trim() === "") return { ok: true as const, value: null };
  const n = Number(value.replace(",", ".").replace(/['\s]/g, ""));
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return { ok: false as const };
  return { ok: true as const, value: n };
}

function optionalText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, maxLength);
  return t === "" ? null : t;
}

/** Prüft ein manuell erfasstes Angebot. Gibt eine verständliche Fehlermeldung zurück statt zu raten. */
export function parseOfferForm(form: FormData): { ok: true; offer: OfferInput } | { ok: false; error: string } {
  const platform = getSupplierPlatform(String(form.get("platform") ?? ""));
  if (!platform) return { ok: false, error: "Unbekannte Plattform." };

  const url = optionalText(form.get("url"), 2000);
  if (!url || !isPlatformUrl(platform, url)) {
    return { ok: false, error: `Der Link muss mit https:// beginnen und auf ${platform.domains.join(" oder ")} zeigen.` };
  }

  const price = optionalNumber(form.get("price"), { max: 1_000_000 });
  const shipping = optionalNumber(form.get("shipping_cost"), { max: 100_000 });
  const moq = optionalNumber(form.get("moq"), { min: 1, max: 10_000_000, integer: true });
  const rating = optionalNumber(form.get("supplier_rating"), { max: 100 });
  if (!price.ok) return { ok: false, error: "Preis ist keine gültige Zahl." };
  if (!shipping.ok) return { ok: false, error: "Versandkosten sind keine gültige Zahl." };
  if (!moq.ok) return { ok: false, error: "Mindestmenge muss eine ganze Zahl ab 1 sein." };
  if (!rating.ok) return { ok: false, error: "Bewertung ist keine gültige Zahl." };

  const currency = String(form.get("currency") ?? "USD");
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { ok: false, error: "Unbekannte Währung." };

  const country = optionalText(form.get("destination_country"), 2)?.toUpperCase() ?? null;
  if (country && !/^[A-Z]{2}$/.test(country)) return { ok: false, error: "Zielland als Kürzel angeben, z. B. CH." };

  return {
    ok: true,
    offer: {
      platform: platform.id,
      role: platform.role,
      url,
      title: optionalText(form.get("title"), 300),
      price: price.value,
      currency: currency as OfferInput["currency"],
      shipping_cost: shipping.value,
      shipping_days: optionalText(form.get("shipping_days"), 40),
      destination_country: country,
      moq: moq.value,
      supplier_rating: rating.value,
      note: optionalText(form.get("note"), 1000),
    },
  };
}

/**
 * Günstigstes bestätigtes Lieferantenangebot in der gewünschten Währung (Preis + Versand).
 * Kandidaten werden nicht verwendet, weil noch nicht sicher ist, ob es dasselbe Produkt ist.
 * Es wird nicht umgerechnet: Angebote in anderen Währungen werden ignoriert.
 */
export function bestSupplierOffer(offers: Offer[], currency: string): Offer | null {
  const usable = offers.filter(
    (o) => o.role === "supplier" && o.matchStatus === "confirmed" && o.price != null && o.currency === currency,
  );
  usable.sort((a, b) => a.price! + (a.shippingCost ?? 0) - (b.price! + (b.shippingCost ?? 0)));
  return usable[0] ?? null;
}

/** Startwerte für den Rechner aus einem Angebot. Felder ohne Daten bleiben leer. */
export function inputsFromOffer(base: ProfitInputs, offer: Offer | null): ProfitInputs {
  if (!offer) return base;
  return {
    ...base,
    purchasePrice: base.purchasePrice ?? offer.price,
    shippingCost: base.shippingCost ?? offer.shippingCost,
  };
}
