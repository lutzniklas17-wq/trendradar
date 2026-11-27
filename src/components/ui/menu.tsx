"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CloseContext = createContext<() => void>(() => {});

/**
 * Einheitliches Dropdown-Menü: öffnet mit kurzer Einblendung, schliesst bei Klick daneben, Escape oder Auswahl.
 * `side="top"` öffnet nach oben (z. B. Kontomenü unten in der Sidebar).
 */
export function Menu({
  trigger,
  label,
  side = "bottom",
  align = "start",
  className,
  panelClassName,
  children,
}: {
  trigger: React.ReactNode;
  label: string;
  side?: "top" | "bottom";
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn("cursor-pointer transition-colors duration-150", className)}
      >
        {trigger}
      </button>
      {open ? (
        <CloseContext.Provider value={() => setOpen(false)}>
          <div
            id={id}
            role="menu"
            className={cn(
              "absolute z-30 min-w-52 animate-pop-in rounded-lg border border-border bg-surface p-1 shadow-popover",
              side === "top" ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top",
              align === "end" ? "right-0" : "left-0",
              panelClassName,
            )}
          >
            {children}
          </div>
        </CloseContext.Provider>
      ) : null}
    </div>
  );
}

const itemClass =
  "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[13px] text-foreground transition-colors duration-150 hover:bg-surface-muted [&_svg]:size-3.5 [&_svg]:text-subtle";

export function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  const close = useContext(CloseContext);
  return (
    <Link href={href} role="menuitem" onClick={close} className={itemClass}>
      {children}
    </Link>
  );
}

/** Menüpunkt, der ein Formular (z. B. Server Action) absendet. */
export function MenuSubmit({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" role="menuitem" className={itemClass}>
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="truncate px-2.5 pt-1.5 pb-1 text-[11px] text-subtle">{children}</p>;
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" role="separator" />;
}
