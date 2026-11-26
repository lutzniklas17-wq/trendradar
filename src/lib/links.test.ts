import { describe, expect, it } from "vitest";
import { groupAdvertisers, safeSearchText, topTitles, type LinkedAd } from "./links";

const ad = (id: string, adv: string | null): LinkedAd => ({
  id,
  external_id: id,
  title: null,
  body: null,
  started_at: null,
  advertiser: adv ? { id: `uuid-${adv}`, name: adv, external_id: `${adv}-page` } : null,
});

describe("Verknüpfungen", () => {
  it("safeSearchText entfernt Filter-Syntax", () => {
    expect(safeSearchText("LED-Maske, (pro)*%")).toBe("LED Maske pro");
  });

  it("groupAdvertisers zählt jede Anzeige einmal und markiert verfolgte Shops", () => {
    const g = groupAdvertisers([ad("1", "Glow"), ad("1", "Glow"), ad("2", "Glow"), ad("3", "Pet"), ad("4", null)], new Map([["Pet-page", "shop-1"]]));
    expect(g).toEqual([
      { id: "uuid-Glow", name: "Glow", pageId: "Glow-page", ads: 2, trackedShopId: null },
      { id: "uuid-Pet", name: "Pet", pageId: "Pet-page", ads: 1, trackedShopId: "shop-1" },
    ]);
  });

  it("topTitles fasst gleiche Titel zusammen", () => {
    expect(topTitles(["Glow Mask", "glow mask ", null, "Bett"])).toEqual([
      { title: "Glow Mask", count: 2 },
      { title: "Bett", count: 1 },
    ]);
  });
});
