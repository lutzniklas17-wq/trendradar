import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AE_METHOD, AeError, buildSearchParams, parseSearchResponse, signParams, toProduct } from "./aliexpress";
import { SupplierError } from "./sources";

const cred = { appKey: "12345", appSecret: "geheim", trackingId: "trendradar" };

describe("signParams", () => {
  it("sortiert nach Name, hängt Name+Wert an und signiert mit HMAC-SHA256 in Grossbuchstaben", () => {
    const sign = signParams({ timestamp: "1", app_key: "12345", method: "x", empty: "" }, "geheim");
    const expected = createHmac("sha256", "geheim").update("app_key12345methodxtimestamp1").digest("hex").toUpperCase();
    expect(sign).toBe(expected);
  });
});

describe("buildSearchParams", () => {
  it("setzt Methode, Pflichtfelder und Signatur", () => {
    const p = buildSearchParams({ keyword: " pet hair remover ", maxPrice: 10 }, cred, new Date(1_700_000_000_000));
    expect(p.get("method")).toBe(AE_METHOD);
    expect(p.get("keywords")).toBe("pet hair remover");
    expect(p.get("timestamp")).toBe("1700000000000");
    expect(p.get("sign_method")).toBe("sha256");
    expect(p.get("tracking_id")).toBe("trendradar");
    expect(p.get("max_sale_price")).toBe("1000");
    expect(p.get("sort")).toBe("LAST_VOLUME_DESC");
    const rest = Object.fromEntries([...p.entries()].filter(([k]) => k !== "sign"));
    expect(p.get("sign")).toBe(signParams(rest, "geheim"));
  });
});

const raw = {
  product_id: 1005006123456789,
  product_title: "Pet Hair Remover Roller",
  product_main_image_url: "https://ae01.alicdn.com/kf/a.jpg",
  target_sale_price: "3.15",
  target_sale_price_currency: "USD",
  lastest_volume: 1532,
  first_level_category_name: "Home & Garden",
  second_level_category_name: "Pet Products",
  shop_name: "Best Pet Store",
  promotion_link: "https://s.click.aliexpress.com/e/_abc",
};

describe("toProduct", () => {
  it("liest die Felder der Affiliate-Antwort", () => {
    const p = toProduct(raw);
    expect(p).toMatchObject({
      externalId: "1005006123456789",
      title: "Pet Hair Remover Roller",
      price: 3.15,
      currency: "USD",
      listedCount: 1532,
      categoryPath: "Home & Garden / Pet Products",
      category: "Pet Products",
      supplierName: "Best Pet Store",
      productUrl: "https://www.aliexpress.com/item/1005006123456789.html",
    });
  });
  it("verwirft Einträge ohne gültige ID oder Titel", () => {
    expect(toProduct({ ...raw, product_id: "abc" })).toBeNull();
    expect(toProduct({ ...raw, product_title: "" })).toBeNull();
  });
});

describe("parseSearchResponse", () => {
  it("liest products.product[] und Seitenangaben", () => {
    const page = parseSearchResponse({
      aliexpress_affiliate_product_query_response: {
        resp_result: { resp_code: 200, result: { products: { product: [raw, raw] }, total_record_count: 120, current_page_no: 1, total_page_no: 3 } },
      },
    });
    expect(page.products).toHaveLength(1);
    expect(page.total).toBe(120);
    expect(page.totalPages).toBe(3);
  });
  it("akzeptiert products als Array und 405 als leere Trefferliste", () => {
    expect(parseSearchResponse({ aliexpress_affiliate_product_query_response: { resp_result: { resp_code: 200, result: { products: [raw] } } } }).products).toHaveLength(1);
    expect(parseSearchResponse({ aliexpress_affiliate_product_query_response: { resp_result: { resp_code: 405, resp_msg: "No result" } } }).products).toEqual([]);
  });
  it("macht aus Signaturfehlern einen Zugangsfehler", () => {
    try {
      parseSearchResponse({ error_response: { code: "IncompleteSignature", msg: "The request signature does not conform to platform standards" } });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AeError);
      expect(e).toBeInstanceOf(SupplierError);
      expect((e as AeError).kind).toBe("auth");
    }
  });
});
