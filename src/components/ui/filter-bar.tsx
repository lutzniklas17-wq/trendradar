"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { inputClass, type SelectOption } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type FilterControl =
  | { kind: "select"; name: string; label: string; value: string; options: readonly SelectOption[] }
  | { kind: "toggle"; name: string; label: string; checked: boolean };

/**
 * Filterleiste für Listen-Seiten. Filter stehen in der URL (teilbar, Zurück-Taste funktioniert)
 * und werden ohne Neuladen der Seite angewendet. Auswahllisten wirken sofort, die Textsuche mit Enter.
 */
export function FilterBar({
  path,
  query,
  queryPlaceholder = "Filtern…",
  controls,
  keep = {},
  active,
  resultLabel,
}: {
  path: string;
  /** Aktueller Freitext; `null` blendet das Textfeld aus. */
  query: string | null;
  queryPlaceholder?: string;
  controls: FilterControl[];
  /** Parameter, die beim Filtern erhalten bleiben (z. B. der Suchbegriff auf /suche). */
  keep?: Record<string, string>;
  active: boolean;
  resultLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  // Leere Felder nicht in die URL schreiben (kurze, lesbare Links)
  const dropEmpty = (e: React.FormEvent<HTMLFormElement>) => {
    const empty = [...e.currentTarget.elements].filter(
      (el): el is HTMLInputElement | HTMLSelectElement =>
        (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && Boolean(el.name) && el.value === "",
    );
    empty.forEach((el) => (el.disabled = true));
    setTimeout(() => empty.forEach((el) => (el.disabled = false)), 0);
  };
  const resetHref = Object.keys(keep).length ? `${path}?${new URLSearchParams(keep)}` : path;

  return (
    <Form
      ref={formRef}
      action={path}
      scroll={false}
      replace
      onSubmit={dropEmpty}
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
      aria-label="Filter"
    >
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {query !== null ? (
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            name="filter"
            type="search"
            defaultValue={query}
            placeholder={queryPlaceholder}
            aria-label="Liste filtern"
            className={cn(inputClass, "h-8 pl-8 text-[13px]")}
          />
        </div>
      ) : null}
      {controls.map((c) =>
        c.kind === "select" ? (
          <label key={c.name} className="flex items-center gap-1.5">
            <span className="sr-only">{c.label}</span>
            <select
              name={c.name}
              defaultValue={c.value}
              onChange={submit}
              title={c.label}
              className={cn(inputClass, "h-8 w-auto max-w-52 cursor-pointer pr-7 text-[13px]", c.value && "border-border-strong")}
            >
              {c.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label
            key={c.name}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[13px] shadow-xs transition-colors select-none",
              c.checked ? "border-accent/30 bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:border-border-strong",
            )}
          >
            <input type="checkbox" name={c.name} value="1" defaultChecked={c.checked} onChange={submit} className="accent-(--accent)" />
            {c.label}
          </label>
        ),
      )}
      <button type="submit" className={buttonClass("secondary", "sm")}>
        Anwenden
      </button>
      {active ? (
        <Link href={resetHref} scroll={false} replace className={buttonClass("ghost", "sm")}>
          <X className="size-3.5" aria-hidden />
          Zurücksetzen
        </Link>
      ) : null}
      {resultLabel ? <span className="ml-auto text-xs text-muted tabular-nums">{resultLabel}</span> : null}
    </Form>
  );
}
