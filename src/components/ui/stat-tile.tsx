import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative";

/**
 * Kennzahl-Kachel: Beschriftung (mit optionalem Symbol), grosse Zahl, optionaler Zusatz.
 * `delta` zeigt eine Veränderung (z. B. „+12 seit gestern“) in Grün/Rot; nur echte, gemessene Werte übergeben.
 */
export function StatTile({
  label,
  value,
  hint,
  title,
  icon: Icon,
  delta,
  deltaTone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  title?: string;
  icon?: LucideIcon;
  delta?: React.ReactNode;
  deltaTone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface px-5 py-4 shadow-card", className)} title={title}>
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        {Icon ? <Icon className="size-3.5 text-subtle" aria-hidden strokeWidth={1.75} /> : null}
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {delta != null ? (
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              deltaTone === "positive" ? "text-positive" : deltaTone === "negative" ? "text-negative" : "text-muted",
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-0.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}
