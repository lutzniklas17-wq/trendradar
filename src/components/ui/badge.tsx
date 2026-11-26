import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
  warning: "bg-warning/10 text-warning",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}
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
