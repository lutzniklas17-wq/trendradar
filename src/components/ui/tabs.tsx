"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: string; count?: number; content: React.ReactNode };

/**
 * Tabs ohne Neuladen: alle Inhalte bleiben gerendert, damit z. B. Eingaben im Rechner beim Wechseln erhalten bleiben.
 * Der aktive Tab steht im URL-Fragment (#rechner), damit Links direkt auf einen Tab zeigen können.
 */
export function Tabs({ items, defaultTab }: { items: TabItem[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const baseId = useId();
  const ids = items.map((i) => i.id).join(",");

  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      if (ids.split(",").includes(hash)) setActive(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [ids]);

  const select = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = items[(index + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];
    select(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {items.map((item, index) => (
          <button
            key={item.id}
            id={`${baseId}-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={active === item.id}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active === item.id ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {item.label}
            {item.count != null ? (
              <span className="rounded bg-surface-muted px-1.5 text-[11px] text-muted tabular-nums">{item.count}</span>
            ) : null}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={active !== item.id}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
