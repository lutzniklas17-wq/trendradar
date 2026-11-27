import { describe, expect, it } from "vitest";
import { pickShops, shouldPauseAutoShop, type ShopCandidateRow } from "./discover";

const row = (o: Partial<ShopCandidateRow>): ShopCandidateRow => ({
  advertiser_id: "a", page_id: "1234567", name: "Shop", active_ads: 10, first_start: null, domain: "shop.ch", terms: ["neck fan"], sample_text: null, ...o,
});

describe("pickShops", () => {
  it("filtert Marktplätze, ausgeschlossene Branchen und ungültige Seiten-IDs", () => {
    const res = pickShops(
      [
        row({ page_id: "1111111", name: "Viele", active_ads: 40 }),
        row({ page_id: "2222222", domain: "amazon.de" }),
        row({ page_id: "3333333", domain: null }),
        row({ page_id: "4444444", name: "Krypto Börse", sample_text: "bitcoin trading crypto" }),
        row({ page_id: "abc" }),
        row({ page_id: "5555555", name: "Wenige", active_ads: 6, domain: "www.Small.ch" }),
      ],
      { activeAuto: 0 },
    );
    expect(res.map((r) => r.name)).toEqual(["Viele", "Wenige"]);
    expect(res[1].domain).toBe("small.ch");
    expect(res[0].reason).toContain("40 verschiedene Anzeigen");
    expect(res[0].reason).toContain("neck fan");
  });

  it("hält Tages- und Gesamtgrenze ein", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ page_id: String(1000000 + i), active_ads: 20 - i }));
    expect(pickShops(rows, { activeAuto: 0 })).toHaveLength(8);
    expect(pickShops(rows, { activeAuto: 27 })).toHaveLength(3);
  });
});

describe("shouldPauseAutoShop", () => {
  it("pausiert automatische Shops nach drei Nullzählungen, nie Favoriten oder eigene", () => {
    expect(shouldPauseAutoShop({ origin: "auto" }, [0, 0, 0, 5])).toBe(true);
    expect(shouldPauseAutoShop({ origin: "auto" }, [0, 0])).toBe(false);
    expect(shouldPauseAutoShop({ origin: "auto" }, [0, 1, 0])).toBe(false);
    expect(shouldPauseAutoShop({ origin: "auto", favorite: true }, [0, 0, 0])).toBe(false);
    expect(shouldPauseAutoShop({ origin: "manual" }, [0, 0, 0])).toBe(false);
  });
});
