import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfitCalculator } from "@/components/profit/profit-calculator";

export const metadata: Metadata = { title: "Profit-Rechner" };

export default function CalculatorPage() {
  return (
    <>
      <PageHeader
        title="Profit-Rechner"
        description="Rechnet realistisch: Mehrwertsteuer, Gebühren, Retouren und Werbekosten werden vom Umsatz abgezogen."
      />
      <ProfitCalculator />
    </>
  );
}
