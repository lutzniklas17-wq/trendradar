"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, ChevronsUpDown, LogOut, Menu as MenuIcon, PanelLeft, Radar, Search, X } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { openCommandPalette } from "@/components/layout/command-palette";
import { Menu, MenuLabel, MenuLink, MenuSeparator, MenuSubmit } from "@/components/ui/menu";
import { isNavActive, NAV_GROUPS, NAV_ITEMS, SIDEBAR_COOKIE } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Zähler neben einem Navigationseintrag, z. B. ungelesene Inbox-Einträge. Schlüssel = href. */
export type NavBadges = Partial<Record<string, number>>;

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 text-[15px] font-semibold tracking-tight", className)} aria-label="TrendRadar, zur Startseite">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-contrast shadow-card">
        <Radar className="size-4" aria-hidden strokeWidth={2} />
      </span>
      {compact ? null : "TrendRadar"}
    </Link>
  );
}

function SearchButton({ compact }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      title="Schnellsuche (⌘K)"
      className={cn(
        "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background text-[13px] text-subtle transition-colors duration-150 hover:border-border-strong hover:text-muted",
        compact ? "justify-center px-0" : "px-3",
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
      {compact ? <span className="sr-only">Schnellsuche</span> : (
        <>
          <span className="flex-1 text-left">Suchen…</span>
          <kbd className="rounded border border-border bg-surface px-1.5 font-sans text-[11px]">⌘K</kbd>
        </>
      )}
    </button>
  );
}

function NavList({ compact, badges }: { compact?: boolean; badges?: NavBadges }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Hauptnavigation">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group} className={cn(gi > 0 && "mt-5")}>
          {compact ? (
            gi > 0 ? <div className="mx-2 mb-3 h-px bg-border" aria-hidden /> : null
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-medium text-subtle">{group}</p>
          )}
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
              const { href, label, icon: Icon } = item;
              const active = isNavActive(pathname, item);
              const count = badges?.[href] ?? 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    title={compact ? label : item.description}
                    className={cn(
                      "group/nav relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors duration-150",
                      compact ? "justify-center px-0" : "px-3",
                      active ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn("size-[18px] shrink-0 transition-colors duration-150", active ? "text-accent" : "text-subtle group-hover/nav:text-muted")}
                      aria-hidden
                      strokeWidth={1.75}
                    />
                    {compact ? <span className="sr-only">{label}</span> : <span className="flex-1 truncate">{label}</span>}
                    {count > 0 ? (
                      compact ? (
                        <span className="absolute top-1.5 right-2 size-1.5 rounded-full bg-accent" aria-label={`${count} neu`} />
                      ) : (
                        <span className="rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent tabular-nums" aria-label={`${count} neu`}>
                          {count > 99 ? "99+" : count}
                        </span>
                      )
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ email, compact }: { email: string | null; compact?: boolean }) {
  const initial = (email ?? "?").slice(0, 1).toUpperCase();
  return (
    <Menu
      label="Konto"
      side="top"
      className={cn("flex h-11 w-full items-center gap-2.5 rounded-lg text-left hover:bg-surface-hover", compact ? "justify-center" : "px-2")}
      panelClassName="w-56"
      trigger={
        <>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-medium text-muted">{initial}</span>
          {compact ? null : (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{email ?? "Konto"}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" aria-hidden />
            </>
          )}
        </>
      }
    >
      {email ? <MenuLabel>{email}</MenuLabel> : null}
      <MenuLink href="/sammler">
        <Bot aria-hidden /> Datensammler und Quellen
      </MenuLink>
      <MenuSeparator />
      <form action={signOut}>
        <MenuSubmit>
          <LogOut aria-hidden /> Abmelden
        </MenuSubmit>
      </form>
    </Menu>
  );
}

/** Feste Seitenleiste ab 1024 px, einklappbar auf Symbole (Zustand im Cookie, damit nichts springt). */
export function Sidebar({ email, badges, defaultCollapsed = false }: { email: string | null; badges?: NavBadges; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "justify-between pr-3 pl-5")}>
        {collapsed ? null : <Logo />}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
        >
          <PanelLeft className="size-4" aria-hidden strokeWidth={1.75} />
        </button>
      </div>
      <div className="px-3 pt-1">
        <SearchButton compact={collapsed} />
      </div>
      <NavList compact={collapsed} badges={badges} />
      <div className="border-t border-border p-3">
        <AccountMenu email={email} compact={collapsed} />
      </div>
    </aside>
  );
}

/** Kopfzeile unter 1024 px: Menü-Knopf öffnet die Navigation als Schublade. */
export function MobileHeader({ email, badges }: { email: string | null; badges?: NavBadges }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Nach dem Wechsel der Seite die Schublade schliessen.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Navigation öffnen"
          aria-expanded={open}
          className="-ml-1.5 flex size-9 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
        >
          <MenuIcon className="size-5" aria-hidden strokeWidth={1.75} />
        </button>
        <Logo />
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Schnellsuche"
          className="ml-auto flex size-9 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
        >
          <Search className="size-[18px]" aria-hidden strokeWidth={1.75} />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-foreground/20 dark:bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-fade-in flex-col border-r border-border bg-surface shadow-popover"
          >
            <div className="flex h-14 items-center justify-between pr-3 pl-5">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Navigation schliessen"
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <NavList badges={badges} />
            <div className="border-t border-border p-3">
              <AccountMenu email={email} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
