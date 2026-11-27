"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { matchesNav, NAV_ITEMS, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const OPEN_PALETTE_EVENT = "trendradar:open-palette";

/** Öffnet die Schnellsuche von überall (Sidebar-Knopf, mobile Kopfzeile). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

type Entry = { key: string; label: string; hint: string; href: string; icon: NavItem["icon"] };

/**
 * Schnellsuche (⌘K / Ctrl+K): springt zu jedem Bereich oder startet die globale Suche.
 * Tastatur: Pfeile wählen, Enter öffnet, Escape schliesst.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim();
    const nav = NAV_ITEMS.filter((i) => matchesNav(i, q)).map((i) => ({
      key: i.href,
      label: i.label,
      hint: i.description,
      href: i.href,
      icon: i.icon,
    }));
    if (!q) return nav;
    return [{ key: "search", label: `Überall nach „${q}“ suchen`, hint: "Globale Suche", href: `/suche?q=${encodeURIComponent(q)}`, icon: Search }, ...nav];
  }, [query]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    close();
    router.push(entry.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[index]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-foreground/20 dark:bg-black/50" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schnellsuche"
        className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-xl border border-border bg-surface shadow-popover"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Bereich öffnen oder Begriff suchen…"
            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-subtle focus-visible:outline-none"
            aria-label="Suchbegriff"
            aria-controls="palette-list"
            aria-activedescendant={entries[index] ? `palette-${entries[index].key}` : undefined}
          />
          <kbd className="hidden rounded border border-border px-1.5 text-[11px] text-subtle sm:inline">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {entries.length === 0 ? <li className="px-3 py-6 text-center text-[13px] text-muted">Kein Bereich gefunden.</li> : null}
          {entries.map((entry, i) => {
            const Icon = entry.icon;
            const active = i === index;
            return (
              <li
                key={entry.key}
                id={`palette-${entry.key}`}
                role="option"
                aria-selected={active}
                onMouseMove={() => setIndex(i)}
                onClick={() => go(entry)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-100",
                  active ? "bg-surface-muted" : "",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
                  <Icon className={cn("size-3.5", active ? "text-accent" : "text-muted")} aria-hidden strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{entry.label}</span>
                  <span className="block truncate text-[12px] text-muted">{entry.hint}</span>
                </span>
                {active ? <CornerDownLeft className="size-3.5 text-subtle" aria-hidden /> : <ArrowRight className="size-3.5 text-transparent" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
