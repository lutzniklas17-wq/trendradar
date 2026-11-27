"use client";

import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { isNavActive, NAV_ITEMS } from "@/lib/navigation";

/**
 * Seitenkopf für alle Seiten ausser den Entdecken-Seiten (die nutzen `BrowseHeader`).
 * Gleicher Aufbau und gleiche Grössen wie `BrowseHeader`, damit alle Seiten einheitlich wirken.
 * Ohne `icon` nimmt er das Symbol des aktiven Navigationseintrags.
 */
export function PageHeader({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const Icon = icon ?? NAV_ITEMS.find((item) => isNavActive(pathname, item))?.icon;
  return (
    <header className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3">
      {Icon ? (
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface shadow-card sm:flex" aria-hidden>
          <Icon className="size-[18px] text-muted" strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}
