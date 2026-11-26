"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar } from "lucide-react";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 text-sm font-medium tracking-tight", className)}>
      <span className="flex size-6 items-center justify-center rounded-md border border-border-strong bg-surface text-foreground">
        <Radar className="size-3.5" aria-hidden strokeWidth={2} />
      </span>
      TrendRadar
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <Logo className="h-14 px-5" />
      <nav className="flex-1 space-y-px overflow-y-auto px-3 py-2" aria-label="Hauptnavigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150",
                active ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:bg-surface-muted/70 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active ? "text-accent" : "text-subtle")} aria-hidden strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 py-4 text-[11px] leading-relaxed text-subtle">Nur echte Daten aus offiziellen Quellen.</p>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border bg-background px-3 py-2 [scrollbar-width:none] lg:hidden"
      aria-label="Hauptnavigation"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors",
              active ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3.5", active ? "text-accent" : "text-subtle")} aria-hidden strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
