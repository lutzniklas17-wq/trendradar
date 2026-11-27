import Link from "next/link";
import { cn } from "@/lib/utils";

export type SegmentItem = { value: string; label: string; href: string; count?: number };

/**
 * Umschalter zwischen Ansichten derselben Seite (Links, Zustand in der URL).
 * Ruhige Segment-Leiste: aktive Ansicht als weisse Fläche mit Schatten.
 */
export function Segmented({ items, active, label, className }: { items: SegmentItem[]; active: string; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-surface-muted p-1 [scrollbar-width:none]", className)}>
      {items.map((item) => {
        const on = item.value === active;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-[color,background-color,box-shadow] duration-150",
              on ? "bg-surface text-foreground shadow-card" : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
            {item.count != null ? <span className="text-[11px] text-subtle tabular-nums">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
