import Link from "next/link";
import { cn } from "@/lib/utils";

export type QuickChip = { href: string; label: string; active: boolean; title?: string };

/** Schnellfilter als Chips über einer Liste. Jeder Chip ist ein Link mit fertigen URL-Filtern. */
export function QuickChips({ items, label = "Schnellwahl", className }: { items: QuickChip[]; label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-4 py-3", className)} role="group" aria-label={label}>
      {items.map((c, i) => (
        <Link
          key={c.href + c.label}
          href={c.href}
          scroll={false}
          title={c.title}
          aria-current={c.active ? "true" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors duration-150",
            c.active ? "border-accent/40 bg-accent-soft font-medium text-accent" : "border-dashed border-border-strong bg-surface text-foreground hover:border-solid hover:bg-surface-muted",
          )}
        >
          <span className="size-1.5 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} aria-hidden />
          {c.label}
        </Link>
      ))}
    </div>
  );
}
