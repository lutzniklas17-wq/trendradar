import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-surface-muted text-muted",
  accent: "border-accent/15 bg-accent-soft text-accent",
  positive: "border-positive/15 bg-positive/8 text-positive",
  negative: "border-negative/15 bg-negative/8 text-negative",
  warning: "border-warning/15 bg-warning/8 text-warning",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

export type Provenance = "data" | "research" | "manual" | "assessment" | "missing" | "empty";

const provenanceLabel: Record<Provenance, { label: string; tone: Tone; title: string }> = {
  data: { label: "Daten", tone: "positive", title: "Aus einer API oder Datenquelle gemessen" },
  research: { label: "Recherche", tone: "accent", title: "Recherchiert, mit Quelle und Datum" },
  manual: { label: "Eingabe", tone: "neutral", title: "Von dir eingegeben" },
  assessment: { label: "Einschätzung", tone: "warning", title: "Einschätzung, keine gemessene Tatsache" },
  missing: { label: "Nicht verfügbar", tone: "neutral", title: "Für diesen Wert gibt es keine Daten" },
  empty: { label: "leer", tone: "neutral", title: "Noch nicht ausgefüllt, wird mit 0 gerechnet" },
};

export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  const p = provenanceLabel[kind];
  return (
    <Badge tone={p.tone} title={p.title}>
      {p.label}
    </Badge>
  );
}
