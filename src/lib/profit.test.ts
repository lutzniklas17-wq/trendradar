import { describe, expect, it } from "vitest";
import { applyScenario, calculateProfit, EMPTY_INPUTS, type ProfitInputs } from "./profit";

const base: ProfitInputs = {
  ...EMPTY_INPUTS,
  purchasePrice: 8,
  shippingCost: 4,
  sellingPrice: 39.9,
  adCostPerOrder: 12,
  packagingCost: 0.5,
  paymentFeePercent: 2.9,
  paymentFeeFixed: 0.3,
  platformFeePercent: 2,
  platformFeeFixed: 0,
  refundRatePercent: 5,
  otherCosts: 0,
  vatPercent: 8.1,
};

describe("calculateProfit", () => {
  it("zieht MWST, Gebühren, Retouren und Werbung ab", () => {
    const r = calculateProfit(base);
    const net = 39.9 / 1.081;
    const fees = 39.9 * 0.029 + 0.3 + 39.9 * 0.02;
    const expectedProfit = net * 0.95 - (8 + 4 + 0.5 + fees + 12);
    expect(r.netRevenue).toBeCloseTo(net, 6);
    expect(r.profitPerOrder).toBeCloseTo(expectedProfit, 6);
    expect(r.marginPercent).toBeCloseTo((expectedProfit / net) * 100, 6);
    expect(r.profitAt.map((p) => p.orders)).toEqual([100, 500, 1000]);
    expect(r.profitAt[2].profit).toBeCloseTo(expectedProfit * 1000, 6);
    expect(r.complete).toBe(true);
  });

  it("Break-even-Preis ergibt genau 0 Gewinn", () => {
    const r = calculateProfit(base);
    expect(r.breakEvenPrice).not.toBeNull();
    const atBreakEven = calculateProfit({ ...base, sellingPrice: r.breakEvenPrice });
    expect(atBreakEven.profitPerOrder).toBeCloseTo(0, 6);
  });

  it("maximale Werbekosten ergeben genau 0 Gewinn", () => {
    const r = calculateProfit(base);
    const atMax = calculateProfit({ ...base, adCostPerOrder: r.maxAdCostPerOrder });
    expect(atMax.profitPerOrder).toBeCloseTo(0, 6);
    expect(r.breakEvenRoas).toBeCloseTo(39.9 / r.maxAdCostPerOrder, 6);
  });

  it("meldet fehlende Pflichtfelder statt Werte zu erfinden", () => {
    const r = calculateProfit({ ...EMPTY_INPUTS, sellingPrice: 20 });
    expect(r.complete).toBe(false);
    expect(r.missing).toContain("purchasePrice");
  });

  it("Break-even ist unerreichbar, wenn Gebühren und Retouren alles auffressen", () => {
    const r = calculateProfit({ ...base, refundRatePercent: 100 });
    expect(r.breakEvenPrice).toBeNull();
    expect(r.breakEvenRoas).toBeNull();
  });

  it("Szenario überschreibt nur gesetzte Felder", () => {
    const merged = applyScenario(base, { adCostPerOrder: 20, sellingPrice: null });
    expect(merged.adCostPerOrder).toBe(20);
    expect(merged.sellingPrice).toBe(39.9);
  });
});
