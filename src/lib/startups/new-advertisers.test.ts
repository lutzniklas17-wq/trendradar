import { describe, expect, it } from "vitest";
import { isShopDomain, pageLibraryUrl, toNewAdvertiserDiscovery, type NewAdvertiserRow } from "@/lib/startups/new-advertisers";

const row = (over: Partial<NewAdvertiserRow> = {}): NewAdvertiserRow => ({
  advertiser_id: "a1",
  page_id: "123",
  name: "Leaf & Paw",
  first_start: "2026-11-10T00:00:00Z",
  known_ads: 4,
  domain: "leafandpaw.ch",
  sample_text: "Nachhaltige Hundeleinen | Jetzt bestellen",
  ...over,
});

describe("isShopDomain", () => {
  it("erkennt Plattformen und Marktplätze", () => {
    expect(isShopDomain("leafandpaw.ch")).toBe(true);
    expect(isShopDomain("instagram.com")).toBe(false);
    expect(isShopDomain("shop.amazon.de")).toBe(false);
    expect(isShopDomain(null)).toBe(false);
  });
});

describe("toNewAdvertiserDiscovery", () => {
  it("macht einen Small-Business-Eintrag mit Quelle, Start und Signal", () => {
    const d = toNewAdvertiserDiscovery(row());
    expect(d).toMatchObject({
      name: "Leaf & Paw",
      area: "startup_spy",
      stage: "small_business",
      launchedAt: "2026-11-10T00:00:00Z",
      websiteUrl: "https://leafandpaw.ch",
      sourceUrl: pageLibraryUrl("123"),
      description: "Nachhaltige Hundeleinen",
      signal: { metric: "meta_known_ads", value: 4 },
    });
    expect(d?.relevance?.relevance).toBe("ecommerce");
  });

  it("überspringt Werbetreibende ohne eigenen Shop oder aus ausgeschlossenen Branchen", () => {
    expect(toNewAdvertiserDiscovery(row({ domain: null }))).toBeNull();
    expect(toNewAdvertiserDiscovery(row({ domain: "facebook.com" }))).toBeNull();
    expect(toNewAdvertiserDiscovery(row({ name: "Alpen Versicherung", sample_text: "Jetzt Offerte" }))).toBeNull();
  });
});
