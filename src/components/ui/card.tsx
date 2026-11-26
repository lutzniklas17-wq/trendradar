import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Hinweisleiste für Fehler oder fehlende Einrichtung, ohne knallige Farben. */
export function Notice({ tone = "warning", children }: { tone?: "warning" | "neutral"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "warning" ? "alert" : undefined}
      className={cn(
        "mb-6 rounded-lg border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/25 bg-warning/5 text-warning" : "border-border bg-surface-muted text-muted",
      )}
    >
      {children}
    </div>
  );
}
