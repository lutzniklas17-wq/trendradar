"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowDownUp,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  CircleDollarSign,
  Eye,
  Filter,
  Globe,
  Layers,
  Sparkles,
  Store,
  Tag,
  Truck,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { sort: ArrowDownUp, ban: Ban, calendar: Calendar, price: CircleDollarSign, eye: Eye, globe: Globe, layers: Layers, sparkles: Sparkles, store: Store, tag: Tag, truck: Truck, video: Video };
export type FilterIcon = keyof typeof ICONS;

export type PanelOption = { label: string; href: string; active: boolean };
export type PanelItem =
  | { kind: "choice"; icon: FilterIcon; label: string; options: PanelOption[] }
  | { kind: "toggle"; icon: FilterIcon; label: string; href: string; active: boolean };
export type PanelGroup = { title: string; items: PanelItem[] };

/**
 * Filterpanel mit Gruppen in Spalten. Jeder Filter ist eine Zeile mit Symbol und Namen;
 * ein Klick öffnet die Auswahl direkt darunter. Alle Optionen sind Links (Filter stehen in der URL).
 */
export function FilterPanel({ groups, resetHref, active }: { groups: PanelGroup[]; resetHref: string; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  // Nur eine Auswahl gleichzeitig offen; Klick daneben oder Escape schliesst sie.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const closeAll = (except?: Element) =>
      root.querySelectorAll<HTMLDetailsElement>("details[data-pop][open]").forEach((d) => d !== except && d.removeAttribute("open"));
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (d.matches?.("details[data-pop]") && d.open) closeAll(d);
    };
    const onClick = (e: MouseEvent) => {
      const inside = (e.target as Element).closest("details[data-pop]");
      closeAll(inside ?? undefined);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    root.addEventListener("toggle", onToggle, true);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="rounded-xl border border-border bg-surface shadow-card">
      <details open className="group/panel">
        <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-4 text-[12px] font-medium tracking-wider text-muted uppercase select-none [&::-webkit-details-marker]:hidden">
          <Filter className="size-3.5" aria-hidden />
          Filter
          {active ? (
            <Link href={resetHref} scroll={false} className="ml-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tracking-normal normal-case text-accent hover:bg-accent-soft">
              <X className="size-3" aria-hidden /> Zurücksetzen
            </Link>
          ) : null}
          <ChevronDown className="ml-auto size-4 transition-transform duration-150 group-open/panel:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g, gi) => (
            <div key={g.title} className={cn("px-4 py-4", gi > 0 && "border-t border-border sm:border-t-0 lg:border-l", gi % 2 === 1 && "sm:border-l")}>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-wider text-muted uppercase">
                <span className="h-3 w-0.5 rounded-full bg-accent" aria-hidden />
                {g.title}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.label}>
                    <Item item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Item({ item }: { item: PanelItem }) {
  const Icon = ICONS[item.icon];
  if (item.kind === "toggle") {
    return (
      <Link
        href={item.href}
        scroll={false}
        aria-pressed={item.active}
        className={cn(
          "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-150",
          item.active ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-surface-muted",
        )}
      >
        <Icon className={cn("size-4", item.active ? "text-accent" : "text-subtle")} aria-hidden strokeWidth={1.75} />
        {item.label}
        {item.active ? <Check className="ml-auto size-3.5" aria-hidden /> : null}
      </Link>
    );
  }
  const selected = item.options.find((o) => o.active && o !== item.options[0]);
  return (
    <details data-pop className="relative">
      <summary
        className={cn(
          "flex h-8 cursor-pointer list-none items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-150 select-none [&::-webkit-details-marker]:hidden",
          selected ? "bg-accent-soft text-accent" : "text-foreground hover:bg-surface-muted",
        )}
      >
        <Icon className={cn("size-4", selected ? "text-accent" : "text-subtle")} aria-hidden strokeWidth={1.75} />
        <span className={cn(selected && "font-medium")}>{item.label}</span>
        {selected ? <span className="ml-auto truncate text-[12px]">{selected.label}</span> : null}
      </summary>
      <ul className="absolute top-9 left-0 z-20 min-w-56 animate-pop-in rounded-lg border border-border bg-surface p-1 shadow-popover" role="listbox" aria-label={item.label}>
        {item.options.map((o) => (
          <li key={o.label}>
            <Link
              href={o.href}
              scroll={false}
              role="option"
              aria-selected={o.active}
              className={cn(
                "flex h-8 items-center justify-between gap-3 rounded-md px-2.5 text-[13px] transition-colors duration-150 hover:bg-surface-muted",
                o.active && "font-medium text-accent",
              )}
            >
              {o.label}
              {o.active ? <Check className="size-3.5" aria-hidden /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
