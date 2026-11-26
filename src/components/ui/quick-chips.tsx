import Link from "next/link";
import { cn } from "@/lib/utils";

export type QuickChip = { href: string; label: string; active: boolean; title?: string };

/** Schnellfilter als Chips über einer Liste. Jeder Chip ist ein Link mit fertigen URL-Filtern. */
export function QuickChips({ items, label = "Schnellwahl" }: { items: QuickChip[]; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3" role="group" aria-label={label}>
      {items.map((c) => (
        <Link
          key={c.href + c.label}
          href={c.href}
          scroll={false}
          title={c.title}
          aria-current={c.active ? "true" : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors duration-150",
            c.active ? "border-accent/30 bg-accent-soft font-medium text-accent" : "border-dashed border-border text-muted hover:border-border-strong hover:text-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", c.active ? "bg-accent" : "bg-subtle")} aria-hidden />
          {c.label}
        </Link>
      ))}
    </div>
  );
}
