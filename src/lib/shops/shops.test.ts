import { describe, expect, it } from "vitest";
import type { MetaAd } from "@/lib/ads/meta";
import { extractDomain, parsePageInput, shopTrend, sortedDomains, summarizeShopAds, zurichDay } from "@/lib/shops/shops";

const ad = (id: string, captions: string[], startedAt: string | null = null): MetaAd => ({
  id,
  pageId: "123456",
  pageName: "Shop",
  bodies: [],
  linkTitles: [],
  linkCaptions: captions,
  linkDescriptions: [],
  createdAt: null,
  startedAt,
  stoppedAt: null,
  platforms: [],
  languages: [],
  euReach: null,
  libraryUrl: `https://www.facebook.com/ads/library/?id=${id}`,
});

describe("parsePageInput", () => {
  it("akzeptiert reine IDs und Ad-Library-Links", () => {
    expect(parsePageInput(" 104958162837 ")).toEqual({ ok: true, pageId: "104958162837" });
    expect(parsePageInput("https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=104958162837")).toEqual({
      ok: true,
      pageId: "104958162837",
    });
    expect(parsePageInput("facebook.com/profile.php?id=100064123456789")).toEqual({ ok: true, pageId: "100064123456789" });
  });

  it("lehnt Seitennamen und fremde Domains ab", () => {
    expect(parsePageInput("https://www.facebook.com/meinshop").ok).toBe(false);
    expect(parsePageInput("https://evil.com/?view_all_page_id=104958162837").ok).toBe(false);
    expect(parsePageInput("").ok).toBe(false);
  });
});

describe("extractDomain", () => {
  it("normalisiert Link-Beschriftungen", () => {
    expect(extractDomain("WWW.SHOP-BEISPIEL.DE")).toBe("shop-beispiel.de");
    expect(extractDomain("https://shop.example.com/products/x?y=1")).toBe("shop.example.com");
    expect(extractDomain("Jetzt kaufen")).toBeNull();
    expect(extractDomain("Gratis Versand")).toBeNull();
    expect(extractDomain("")).toBeNull();
  });
});

describe("summarizeShopAds", () => {
  it("zählt eindeutige Anzeigen, Domains und neue Anzeigen", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    const s = summarizeShopAds(
      [
        ad("1", ["SHOP.DE"], "2026-11-24"),
        ad("1", ["SHOP.DE"], "2026-11-24"),
        ad("2", ["shop.de"], "2026-09-01"),
        ad("3", ["andere.com"], "2026-11-20"),
        ad("4", ["Jetzt kaufen"]),
      ],
      now,
    );
    expect(s.activeAds).toBe(4);
    expect(s.domains).toEqual({ "shop.de": 2, "andere.com": 1, "": 1 });
    expect(s.newAds).toBe(2);
    expect(s.longestDays).toBe(86);
    expect(sortedDomains(s.domains)).toEqual([
      { domain: "shop.de", count: 2 },
      { domain: "andere.com", count: 1 },
    ]);
  });
});

describe("shopTrend", () => {
  it("vergleicht mit dem Stand vor mindestens 7 Tagen", () => {
    const t = shopTrend([
      { day: "2026-11-10", activeAds: 4, capped: false },
      { day: "2026-11-18", activeAds: 5, capped: false },
      { day: "2026-11-22", activeAds: 9, capped: false },
      { day: "2026-11-26", activeAds: 40, capped: false },
    ]);
    expect(t?.previous?.day).toBe("2026-11-18");
    expect(t?.delta).toBe(35);
    expect(t?.scaling).toBe(true);
    expect(t?.dropping).toBe(false);
  });

  it("ohne alten Stand kein Vergleich", () => {
    const t = shopTrend([{ day: "2026-11-26", activeAds: 3, capped: false }]);
    expect(t?.previous).toBeNull();
    expect(t?.delta).toBeNull();
    expect(shopTrend([])).toBeNull();
  });

  it("erkennt starke Rückgänge", () => {
    const t = shopTrend([
      { day: "2026-11-01", activeAds: 30, capped: false },
      { day: "2026-11-26", activeAds: 10, capped: false },
    ]);
    expect(t?.dropping).toBe(true);
    expect(t?.scaling).toBe(false);
  });
});

describe("zurichDay", () => {
  it("nutzt die Zürcher Zeit", () => {
    expect(zurichDay(new Date("2026-11-26T23:30:00Z"))).toBe("2026-11-27");
    expect(zurichDay(new Date("2026-11-26T10:00:00Z"))).toBe("2026-11-26");
  });
});
