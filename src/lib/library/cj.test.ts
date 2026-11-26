import { describe, expect, it } from "vitest";
import { buildListUrl, CJ_FLAG, CJ_ORDER, CjError, parseListResponse, parseTokenResponse, toProduct } from "./cj";

describe("buildListUrl", () => {
  it("setzt Parameter laut Doku (keyWord, page, size, orderBy)", () => {
    const url = buildListUrl({ keyword: " posture corrector ", orderBy: CJ_ORDER.listed, countryCode: "DE", maxPrice: 10 });
    expect(url.pathname).toBe("/api2.0/v1/product/listV2");
    expect(url.searchParams.get("keyWord")).toBe("posture corrector");
    expect(url.searchParams.get("orderBy")).toBe("1");
    expect(url.searchParams.get("sort")).toBe("desc");
    expect(url.searchParams.get("countryCode")).toBe("DE");
    expect(url.searchParams.get("endSellPrice")).toBe("10");
    expect(url.searchParams.get("size")).toBe("50");
  });
  it("begrenzt Seite und Grösse und ignoriert ungültige Länder", () => {
    const url = buildListUrl({ page: 5000, size: 500, countryCode: "de", flag: CJ_FLAG.trending });
    expect(url.searchParams.get("page")).toBe("1000");
    expect(url.searchParams.get("size")).toBe("100");
    expect(url.searchParams.get("countryCode")).toBeNull();
    expect(url.searchParams.get("productFlag")).toBe("0");
    expect(url.searchParams.get("keyWord")).toBeNull();
  });
});

const raw = {
  id: "1424608189734850560",
  nameEn: "Electric Lint Remover",
  sku: "CJJJ1234",
  bigImage: "https://cf.cjdropshipping.com/a.jpg",
  sellPrice: "4.27",
  nowPrice: "",
  listedNum: 312,
  oneCategoryName: "Home & Garden",
  twoCategoryName: "Household",
  threeCategoryName: "Cleaning",
  addMarkStatus: 1,
  isVideo: 0,
  warehouseInventoryNum: 1500,
  createAt: 1764000000000,
};

describe("toProduct", () => {
  it("liest die Felder der Produktliste V2", () => {
    const p = toProduct(raw)!;
    expect(p.externalId).toBe("1424608189734850560");
    expect(p.price).toBe(4.27);
    expect(p.listedCount).toBe(312);
    expect(p.categoryPath).toBe("Home & Garden / Household / Cleaning");
    expect(p.category).toBe("Cleaning");
    expect(p.freeShipping).toBe(true);
    expect(p.hasVideo).toBe(false);
    expect(p.listedAt).toBe(new Date(1764000000000).toISOString());
    expect(p.productUrl).toContain("CJJJ1234");
  });
  it("verwirft Einträge ohne ID oder Titel und unsichere Bilder", () => {
    expect(toProduct({ nameEn: "x" })).toBeNull();
    expect(toProduct({ ...raw, bigImage: "http://x/a.jpg" })!.imageUrl).toBeNull();
    expect(toProduct({ ...raw, bigImage: "//cf.cj.com/a.jpg" })!.imageUrl).toBe("https://cf.cj.com/a.jpg");
    expect(toProduct({ ...raw, sellPrice: "2.10 -- 3.40" })!.price).toBe(2.1);
  });
});

describe("parseListResponse", () => {
  it("liest data.content[].productList[] und entfernt Doppelte", () => {
    const page = parseListResponse({
      code: 200,
      result: true,
      data: { pageNumber: 1, totalRecords: 2, totalPages: 1, content: [{ productList: [raw, raw, { id: "2", nameEn: "Mini Blender" }] }] },
    });
    expect(page.products.map((p) => p.externalId)).toEqual(["1424608189734850560", "2"]);
    expect(page.total).toBe(2);
  });
  it("übersetzt Fehler", () => {
    expect(() => parseListResponse({ code: 1600001, result: false, message: "Authentication failed", data: null })).toThrow(CjError);
    try {
      parseListResponse({ code: 1600100, result: false, message: "Param error" });
    } catch (e) {
      expect((e as CjError).kind).toBe("request");
    }
  });
});

describe("parseTokenResponse", () => {
  it("liest Token und Ablaufdatum", () => {
    const t = parseTokenResponse({ code: 200, result: true, data: { accessToken: "abc", accessTokenExpiryDate: "2027-04-22T22:33:41+08:00" } });
    expect(t.token).toBe("abc");
    expect(t.expiresAt).toBe("2027-04-22T14:33:41.000Z");
  });
  it("meldet abgelehnten Schlüssel als Zugangsfehler", () => {
    expect(() => parseTokenResponse({ code: 1601000, result: false, message: "User not find", data: null })).toThrow(/CJ_API_KEY/);
  });
});

describe("toProduct Grenzfälle", () => {
  it("begrenzt sehr grosse Zahlen und ignoriert ungültige Zeitstempel", () => {
    const p = toProduct({ ...raw, warehouseInventoryNum: 99_999_999_999, listedNum: "abc", createAt: 9e18 })!;
    expect(p.inventory).toBe(2_147_483_647);
    expect(p.listedCount).toBeNull();
    expect(p.listedAt).toBeNull();
  });
});
