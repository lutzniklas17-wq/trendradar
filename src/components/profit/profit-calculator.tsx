"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  applyScenario,
  calculateProfit,
  EMPTY_INPUTS,
  REQUIRED_FIELDS,
  type ProfitField,
  type ProfitInputs,
  type ProfitResult,
  type ScenarioKey,
  type ScenarioOverrides,
} from "@/lib/profit";
import { Card, CardHeader } from "@/components/ui/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";

type FieldDef = { key: ProfitField; label: string; unit: "money" | "percent"; hint?: string };

const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Einkauf",
    fields: [
      { key: "purchasePrice", label: "Einkaufspreis pro Stück", unit: "money" },
      { key: "shippingCost", label: "Versandkosten pro Stück", unit: "money" },
      { key: "packagingCost", label: "Verpackungskosten", unit: "money" },
    ],
  },
  {
    title: "Verkauf",
    fields: [
      { key: "sellingPrice", label: "Verkaufspreis (brutto)", unit: "money", hint: "inkl. Mehrwertsteuer" },
      { key: "vatPercent", label: "Mehrwertsteuer", unit: "percent", hint: "0, wenn nicht relevant" },
      { key: "refundRatePercent", label: "Rückerstattungen / Retouren", unit: "percent", hint: "Anteil der Bestellungen" },
    ],
  },
  {
    title: "Marketing und Gebühren",
    fields: [
      { key: "adCostPerOrder", label: "Werbekosten pro Bestellung (CPA)", unit: "money" },
      { key: "paymentFeePercent", label: "Zahlungsgebühr", unit: "percent" },
      { key: "paymentFeeFixed", label: "Zahlungsgebühr fix", unit: "money", hint: "pro Transaktion" },
      { key: "platformFeePercent", label: "Shop- / Plattformgebühr", unit: "percent" },
      { key: "platformFeeFixed", label: "Shop- / Plattformgebühr fix", unit: "money", hint: "pro Bestellung" },
      { key: "otherCosts", label: "Sonstige Kosten", unit: "money" },
    ],
  },
];

const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "conservative", label: "Konservativ" },
  { key: "realistic", label: "Realistisch" },
  { key: "optimistic", label: "Optimistisch" },
];

const SCENARIO_FIELDS: { key: keyof ScenarioOverrides; label: string; unit: "money" | "percent" }[] = [
  { key: "sellingPrice", label: "Verkaufspreis", unit: "money" },
  { key: "adCostPerOrder", label: "Werbekosten / Bestellung", unit: "money" },
  { key: "refundRatePercent", label: "Retouren", unit: "percent" },
];

export type ProvenanceMap = Partial<Record<ProfitField, Exclude<Provenance, "missing" | "manual" | "empty">>>;

function parse(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function NumberInput({
  value,
  onChange,
  unit,
  currency,
  label,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit: "money" | "percent";
  currency: string;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parse(text) !== value) setText(value == null ? "" : String(value));
  }
  return (
    <div className={cn("relative", className)}>
      <input
        inputMode="decimal"
        aria-label={label}
        value={text}
        placeholder="–"
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
        className="h-9 w-full rounded-lg border border-border bg-background pr-12 pl-3 text-right text-sm tabular-nums outline-none focus:border-accent"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
        {unit === "percent" ? "%" : currency}
      </span>
    </div>
  );
}

function Money({ value, currency, signed }: { value: number; currency: string; signed?: boolean }) {
  return (
    <span className={cn("tabular-nums", signed && (value < 0 ? "text-negative" : value > 0 ? "text-positive" : ""))}>
      {formatNumber(value)} {currency}
    </span>
  );
}

export function ProfitCalculator({
  initialInputs = EMPTY_INPUTS,
  provenance = {},
  currency: initialCurrency = "CHF",
}: {
  initialInputs?: ProfitInputs;
  provenance?: ProvenanceMap;
  currency?: string;
}) {
  const [inputs, setInputs] = useState<ProfitInputs>(initialInputs);
  const [touched, setTouched] = useState<Set<ProfitField>>(new Set());
  const [currency, setCurrency] = useState(initialCurrency);
  const [scenarios, setScenarios] = useState<Record<ScenarioKey, ScenarioOverrides>>({
    conservative: {},
    realistic: {},
    optimistic: {},
  });

  const result = useMemo(() => calculateProfit(inputs), [inputs]);
  const scenarioResults = useMemo(
    () =>
      Object.fromEntries(
        SCENARIOS.map(({ key }) => [key, calculateProfit(applyScenario(inputs, scenarios[key]))]),
      ) as Record<ScenarioKey, ProfitResult>,
    [inputs, scenarios],
  );

  const provenanceOf = (key: ProfitField): Provenance => {
    if (inputs[key] == null) return "empty";
    if (!touched.has(key) && provenance[key]) return provenance[key]!;
    return "manual";
  };

  const setField = (key: ProfitField, value: number | null) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => new Set(prev).add(key));
  };

  const optionalMissing = result.missing.filter((k) => !REQUIRED_FIELDS.includes(k));

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader
          title="Eingaben"
          description="Alle Werte pro Bestellung. Leere Felder werden mit 0 gerechnet und markiert."
          action={
            <label className="flex items-center gap-2 text-sm text-muted">
              Währung
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              >
                {["CHF", "EUR", "USD"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          }
        />
        <div className="space-y-6 p-5">
          {FIELD_GROUPS.map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{group.title}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.fields.map((f) => (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {f.label}
                        {REQUIRED_FIELDS.includes(f.key) ? <span className="text-negative"> *</span> : null}
                      </span>
                      <ProvenanceBadge kind={provenanceOf(f.key)} />
                    </div>
                    <NumberInput
                      label={f.label}
                      value={inputs[f.key]}
                      onChange={(v) => setField(f.key, v)}
                      unit={f.unit}
                      currency={currency}
                    />
                    {f.hint ? <p className="mt-1 text-xs text-muted">{f.hint}</p> : null}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Card>

      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader title="Ergebnis pro Bestellung" />
          <div className="p-5">
            {!result.complete ? (
              <p className="mb-4 flex gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Einkaufspreis und Verkaufspreis fehlen noch. Ohne sie ist das Ergebnis nicht aussagekräftig.
              </p>
            ) : null}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-xs text-muted">Gewinn pro Bestellung</p>
                <p className="mt-1 text-xl font-semibold">
                  <Money value={result.profitPerOrder} currency={currency} signed />
                </p>
              </div>
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-xs text-muted">Marge (vom Netto-Umsatz)</p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold tabular-nums",
                    result.marginPercent != null && result.marginPercent < 0 && "text-negative",
                  )}
                >
                  {result.marginPercent == null ? "–" : `${formatNumber(result.marginPercent, 1)} %`}
                </p>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ["Umsatz brutto", result.grossRevenue],
                ["Mehrwertsteuer", -result.vatAmount],
                ["Umsatz netto", result.netRevenue],
                ["Rückerstattungen (erwartet)", -result.refundLoss],
                ["Beschaffung (Einkauf + Versand)", -result.procurementCosts],
                ["Zahlungsgebühren", -result.paymentFees],
                ["Shop- / Plattformgebühren", -result.platformFees],
                ["Variable Kosten gesamt", -result.variableCosts],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd>
                    <Money value={value as number} currency={currency} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Grenzwerte" description="Ab wann verlierst du Geld?" />
          <dl className="grid grid-cols-1 gap-3 p-5 text-sm sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div>
              <dt className="text-muted">Break-even-Preis</dt>
              <dd className="mt-0.5 font-semibold">
                {result.breakEvenPrice == null ? "nicht erreichbar" : <Money value={result.breakEvenPrice} currency={currency} />}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Max. Werbekosten / Bestellung</dt>
              <dd className="mt-0.5 font-semibold">
                <Money value={result.maxAdCostPerOrder} currency={currency} signed />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Break-even-ROAS</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {result.breakEvenRoas == null ? "nicht erreichbar" : formatNumber(result.breakEvenRoas)}
              </dd>
            </div>
          </dl>
        </Card>

        {optionalMissing.length > 0 && result.complete ? (
          <p className="flex gap-2 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {optionalMissing.length} Felder sind leer und wurden mit 0 gerechnet. Das Ergebnis ist dadurch eher zu
            optimistisch.
          </p>
        ) : null}
      </div>

      <Card className="xl:col-span-5">
        <CardHeader
          title="Szenarien"
          description="Leere Felder übernehmen die Werte von oben. Du setzt die Annahmen; es werden keine Werte vorgeschlagen."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-5 py-3 font-medium">Annahme / Ergebnis</th>
                {SCENARIOS.map((s) => (
                  <th key={s.key} className="px-5 py-3 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCENARIO_FIELDS.map((f) => (
                <tr key={f.key} className="border-b border-border">
                  <td className="px-5 py-2 text-muted">{f.label}</td>
                  {SCENARIOS.map((s) => (
                    <td key={s.key} className="px-5 py-2">
                      <NumberInput
                        label={`${f.label} ${s.label}`}
                        value={scenarios[s.key][f.key] ?? null}
                        unit={f.unit}
                        currency={currency}
                        onChange={(v) =>
                          setScenarios((prev) => ({ ...prev, [s.key]: { ...prev[s.key], [f.key]: v } }))
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {(
                [
                  ["Gewinn pro Bestellung", (r: ProfitResult) => r.profitPerOrder],
                  ["Gewinn bei 100 Bestellungen", (r: ProfitResult) => r.profitAt[0].profit],
                  ["Gewinn bei 500 Bestellungen", (r: ProfitResult) => r.profitAt[1].profit],
                  ["Gewinn bei 1'000 Bestellungen", (r: ProfitResult) => r.profitAt[2].profit],
                ] as const
              ).map(([label, pick]) => (
                <tr key={label} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium">{label}</td>
                  {SCENARIOS.map((s) => (
                    <td key={s.key} className="px-5 py-3 font-medium">
                      <Money value={pick(scenarioResults[s.key])} currency={currency} signed />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-3 text-muted">Marge</td>
                {SCENARIOS.map((s) => {
                  const m = scenarioResults[s.key].marginPercent;
                  return (
                    <td key={s.key} className="px-5 py-3 tabular-nums">
                      {m == null ? "–" : `${formatNumber(m, 1)} %`}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Fixkosten wie Shop-Abo, Software oder dein Zeitaufwand sind nicht enthalten. Gewinn bei 100 bis 1&apos;000 Bestellungen
          ist eine Hochrechnung, keine Prognose.
        </p>
      </Card>
    </div>
  );
}
