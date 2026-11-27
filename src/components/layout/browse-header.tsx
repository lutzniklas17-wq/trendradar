import type { LucideIcon } from "lucide-react";

/** Kopf der Entdecken-Seiten: Symbol, grosser Titel mit Akzentwort, Untertitel in derselben Zeile, Aktion rechts. */
export function BrowseHeader({
  icon: Icon,
  title,
  accent,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  accent: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="hidden size-10 items-center justify-center rounded-lg border border-border bg-surface shadow-xs sm:flex" aria-hidden>
        <Icon className="size-[18px] text-muted" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {title} <span className="text-accent">{accent}</span>
        </h1>
        {description ? <p className="text-[15px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="hidden sm:block">{action}</div> : null}
    </header>
  );
}
