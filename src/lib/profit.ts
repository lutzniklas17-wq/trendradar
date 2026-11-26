/**
 * Profit-Kalkulator: reine Rechenlogik ohne UI.
 *
 * Konventionen
 * - Alle Beträge sind pro Bestellung und in derselben Währung.
 * - Der Verkaufspreis ist ein Bruttopreis (inkl. Mehrwertsteuer).
 * - Prozentwerte werden als Zahl 0–100 übergeben (z. B. 2.9 für 2.9 %).
 * - Leere Felder (null) werden als 0 gerechnet, aber in `missing` gemeldet,
 *   damit die Oberfläche transparent zeigen kann, was nicht erfasst ist.
 */

export type ProfitInputs = {
  /** Einkaufspreis pro Stück */
  purchasePrice: number | null;
  /** Versandkosten pro Stück (Lieferant zum Kunden) */
  shippingCost: number | null;
  /** Verkaufspreis brutto (inkl. MWST) */
  sellingPrice: number | null;
  /** Werbekosten pro Bestellung (CPA) */
  adCostPerOrder: number | null;
  /** Verpackungskosten pro Bestellung */
  packagingCost: number | null;
  /** Zahlungsgebühr in % vom Bruttopreis */
  paymentFeePercent: number | null;
  /** Fixe Zahlungsgebühr pro Transaktion */
  paymentFeeFixed: number | null;
  /** Shop- bzw. Plattformgebühr in % vom Bruttopreis */
  platformFeePercent: number | null;
  /** Fixe Shop- bzw. Plattformgebühr pro Bestellung */
  platformFeeFixed: number | null;
  /** Anteil Bestellungen mit Rückerstattung in % */
  refundRatePercent: number | null;
  /** Sonstige Kosten pro Bestellung */
  otherCosts: number | null;
  /** Mehrwertsteuersatz in % (0, wenn nicht relevant) */
  vatPercent: number | null;
};

export type ProfitField = keyof ProfitInputs;

export const REQUIRED_FIELDS: ProfitField[] = ["purchasePrice", "sellingPrice"];

export type ProfitResult = {
  /** false, wenn Pflichtfelder fehlen; dann sind die Zahlen nicht aussagekräftig */
  complete: boolean;
  missing: ProfitField[];
  grossRevenue: number;
  netRevenue: number;
  vatAmount: number;
  /** Erwarteter Netto-Umsatz nach Rückerstattungen */
  expectedNetRevenue: number;
  refundLoss: number;
  procurementCosts: number;
  paymentFees: number;
  platformFees: number;
  variableCosts: number;
  profitPerOrder: number;
  /** Marge in % vom Netto-Umsatz; null, wenn kein Umsatz */
  marginPercent: number | null;
  profitAt: { orders: number; profit: number }[];
  /** Gewinn vor Werbekosten = maximal tragbare Werbekosten pro Bestellung */
  maxAdCostPerOrder: number;
  /** Bruttopreis, bei dem der Gewinn genau 0 ist; null, wenn unerreichbar */
  breakEvenPrice: number | null;
  /** Benötigter ROAS (Bruttoumsatz / Werbekosten), um nicht zu verlieren; null, wenn unerreichbar */
  breakEvenRoas: number | null;
};

const ORDER_STEPS = [100, 500, 1000];

const n = (value: number | null) => (value == null || Number.isNaN(value) ? 0 : value);
const pct = (value: number | null) => n(value) / 100;

export function calculateProfit(inputs: ProfitInputs): ProfitResult {
  const missing = (Object.keys(inputs) as ProfitField[]).filter(
    (key) => inputs[key] == null || Number.isNaN(inputs[key] as number),
  );
  const complete = REQUIRED_FIELDS.every((key) => !missing.includes(key));

  const gross = n(inputs.sellingPrice);
  const vatRate = pct(inputs.vatPercent);
  const refundRate = Math.min(Math.max(pct(inputs.refundRatePercent), 0), 1);

  const netRevenue = gross / (1 + vatRate);
  const vatAmount = gross - netRevenue;
  const refundLoss = netRevenue * refundRate;
  const expectedNetRevenue = netRevenue - refundLoss;

  const procurementCosts = n(inputs.purchasePrice) + n(inputs.shippingCost);
  const paymentFees = gross * pct(inputs.paymentFeePercent) + n(inputs.paymentFeeFixed);
  const platformFees = gross * pct(inputs.platformFeePercent) + n(inputs.platformFeeFixed);
  const adCost = n(inputs.adCostPerOrder);

  const variableCosts =
    procurementCosts +
    n(inputs.packagingCost) +
    paymentFees +
    platformFees +
    adCost +
    n(inputs.otherCosts);

  const profitPerOrder = expectedNetRevenue - variableCosts;
  const marginPercent = netRevenue > 0 ? (profitPerOrder / netRevenue) * 100 : null;
  const maxAdCostPerOrder = profitPerOrder + adCost;

  // Gewinn(P) = P * ((1 - r) / (1 + v) - fee%) - fixe Kosten = 0
  const fixedPerOrder =
    procurementCosts +
    n(inputs.packagingCost) +
    n(inputs.paymentFeeFixed) +
    n(inputs.platformFeeFixed) +
    adCost +
    n(inputs.otherCosts);
  const priceFactor =
    (1 - refundRate) / (1 + vatRate) - pct(inputs.paymentFeePercent) - pct(inputs.platformFeePercent);
  const breakEvenPrice = priceFactor > 0 ? fixedPerOrder / priceFactor : null;

  const breakEvenRoas = maxAdCostPerOrder > 0 && gross > 0 ? gross / maxAdCostPerOrder : null;

  return {
    complete,
    missing,
    grossRevenue: gross,
    netRevenue,
    vatAmount,
    expectedNetRevenue,
    refundLoss,
    procurementCosts,
    paymentFees,
    platformFees,
    variableCosts,
    profitPerOrder,
    marginPercent,
    profitAt: ORDER_STEPS.map((orders) => ({ orders, profit: profitPerOrder * orders })),
    maxAdCostPerOrder,
    breakEvenPrice,
    breakEvenRoas,
  };
}

export type ScenarioKey = "conservative" | "realistic" | "optimistic";

/** Felder, die je Szenario abweichen dürfen. Alles andere kommt aus den Basiswerten. */
export type ScenarioOverrides = Partial<
  Pick<ProfitInputs, "sellingPrice" | "adCostPerOrder" | "refundRatePercent">
>;

export function applyScenario(base: ProfitInputs, overrides: ScenarioOverrides): ProfitInputs {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides) as [keyof ScenarioOverrides, number | null | undefined][]) {
    if (value != null && !Number.isNaN(value)) merged[key] = value;
  }
  return merged;
}

export const EMPTY_INPUTS: ProfitInputs = {
  purchasePrice: null,
  shippingCost: null,
  sellingPrice: null,
  adCostPerOrder: null,
  packagingCost: null,
  paymentFeePercent: null,
  paymentFeeFixed: null,
  platformFeePercent: null,
  platformFeeFixed: null,
  refundRatePercent: null,
  otherCosts: null,
  vatPercent: null,
};
