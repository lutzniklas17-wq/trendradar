import { describe, expect, it } from "vitest";
import { bestSupplierOffer, inputsFromOffer, parseOfferForm, type Offer } from "./offers";
import { EMPTY_INPUTS } from "./profit";
import { isPlatformUrl, SUPPLIER_PLATFORMS } from "./platforms";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("isPlatformUrl", () => {
  const ali = SUPPLIER_PLATFORMS.find((p) => p.id === "aliexpress")!;
  it("erlaubt die Plattform und Subdomains, nur über https", () => {
    expect(isPlatformUrl(ali, "https://de.aliexpress.com/item/100.html")).toBe(true);
    expect(isPlatformUrl(ali, "http://www.aliexpress.com/item/1.html")).toBe(false);
    expect(isPlatformUrl(ali, "https://aliexpress.com.evil.example/item")).toBe(false);
    expect(isPlatformUrl(ali, "https://evilaliexpress.com/item")).toBe(false);
    expect(isPlatformUrl(ali, "kein link")).toBe(false);
  });
});

describe("parseOfferForm", () => {
  it("liest ein gültiges Angebot mit Komma als Dezimaltrennzeichen", () => {
    const r = parseOfferForm(
      form({
        platform: "cj",
        url: "https://cjdropshipping.com/product/abc.html",
        price: "8,40",
        currency: "USD",
        shipping_cost: "3.10",
        shipping_days: "7–12",
        destination_country: "ch",
        moq: "1",
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.offer.price).toBe(8.4);
    expect(r.offer.role).toBe("supplier");
    expect(r.offer.destination_country).toBe("CH");
    expect(r.offer.supplier_rating).toBeNull();
  });

  it("Temu ist nur Preisreferenz", () => {
    const r = parseOfferForm(form({ platform: "temu", url: "https://www.temu.com/x.html", currency: "CHF" }));
    expect(r.ok && r.offer.role).toBe("price_reference");
  });

  it("lehnt fremde Links, negative Preise und halbe Mindestmengen ab", () => {
    expect(parseOfferForm(form({ platform: "cj", url: "https://example.com", currency: "USD" })).ok).toBe(false);
    expect(
      parseOfferForm(form({ platform: "cj", url: "https://cjdropshipping.com/p", price: "-1", currency: "USD" })).ok,
    ).toBe(false);
    expect(
      parseOfferForm(form({ platform: "cj", url: "https://cjdropshipping.com/p", moq: "1.5", currency: "USD" })).ok,
    ).toBe(false);
    expect(parseOfferForm(form({ platform: "amazon", url: "https://amazon.de", currency: "USD" })).ok).toBe(false);
  });
});

const offer = (o: Partial<Offer>): Offer => ({
  id: "x",
  platform: "cj",
  role: "supplier",
  url: "https://cjdropshipping.com/p",
  title: null,
  isSearchLink: false,
  matchStatus: "confirmed",
  price: 10,
  currency: "USD",
  shippingCost: null,
  shippingDays: null,
  destinationCountry: null,
  moq: null,
  supplierRating: null,
  dataOrigin: "manual",
  note: null,
  fetchedAt: "",
  updatedAt: "",
  ...o,
});

describe("bestSupplierOffer", () => {
  it("nimmt das günstigste bestätigte Angebot inkl. Versand in der gleichen Währung", () => {
    const best = bestSupplierOffer(
      [
        offer({ id: "a", price: 8, shippingCost: 6 }),
        offer({ id: "b", price: 9, shippingCost: 2 }),
        offer({ id: "c", price: 1, matchStatus: "candidate" }),
        offer({ id: "d", price: 1, currency: "EUR" }),
        offer({ id: "e", price: 1, role: "price_reference" }),
      ],
      "USD",
    );
    expect(best?.id).toBe("b");
  });

  it("übernimmt nur Felder, die noch leer sind", () => {
    const inputs = inputsFromOffer({ ...EMPTY_INPUTS, purchasePrice: 5 }, offer({ price: 9, shippingCost: 2 }));
    expect(inputs.purchasePrice).toBe(5);
    expect(inputs.shippingCost).toBe(2);
  });
});
