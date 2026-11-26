import { describe, expect, it } from "vitest";
import { AI_MODEL, costUsd, remainingBudget } from "./pricing";

describe("KI-Kosten", () => {
  it("rechnet Tokens in USD um", () => {
    expect(costUsd(AI_MODEL, 1_000_000, 0)).toBeCloseTo(0.1);
    expect(costUsd(AI_MODEL, 2000, 1000)).toBeCloseTo(0.0007);
    expect(costUsd("unbekannt", 1000, 1000)).toBe(0);
  });
  it("verteilt das Monatsbudget auf Tage und überschreitet es nie", () => {
    expect(remainingBudget(6, 0, 0)).toBeCloseTo(0.2);
    expect(remainingBudget(6, 0.15, 1)).toBeCloseTo(0.05);
    expect(remainingBudget(6, 0, 5.95)).toBeCloseTo(0.05);
    expect(remainingBudget(6, 0.3, 1)).toBe(0);
  });
});
