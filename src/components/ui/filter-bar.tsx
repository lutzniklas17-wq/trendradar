"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { inputClass, type SelectOption } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type FilterGroup = { title: string; controls: FilterControl[] };

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
  groups = [],
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
  /** Weitere Filter in Gruppen, in einem aufklappbaren Bereich unter der Leiste. */
  groups?: FilterGroup[];
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
  const renderControl = (c: FilterControl) => <Control key={c.name} control={c} onChange={submit} />;
  const groupActive = groups.some((g) => g.controls.some((c) => (c.kind === "select" ? c.value !== "" && c.value !== c.options[0]?.value : c.checked)));
  const resetHref = Object.keys(keep).length ? `${path}?${new URLSearchParams(keep)}` : path;

  return (
    <Form
      ref={formRef}
      action={path}
      scroll={false}
      replace
      onSubmit={dropEmpty}
      className="border-b border-border"
      aria-label="Filter"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
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
      {controls.map(renderControl)}
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
      </div>
      {groups.length ? (
        <details open={groupActive} className="group border-t border-border">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-4 text-[13px] text-muted transition-colors duration-150 select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Filter className="size-3.5" aria-hidden />
            Weitere Filter
            <ChevronDown className="ml-auto size-3.5 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="grid gap-x-6 gap-y-4 px-4 pt-1 pb-4 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <fieldset key={g.title} className="min-w-0 border-l border-border pl-3">
                <legend className="mb-2 text-[12px] text-muted">{g.title}</legend>
                <div className="flex flex-col items-start gap-2 [&_label:has(select)]:w-full [&_select]:w-full [&_select]:max-w-none">
                  {g.controls.map((c) => (
                    <Control key={c.name} control={c} onChange={submit} showLabel={g.controls.length > 1} />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </details>
      ) : null}
    </Form>
  );
}

function Control({ control: c, onChange, showLabel = false }: { control: FilterControl; onChange: () => void; showLabel?: boolean }) {
  if (c.kind === "select") {
    return (
      <label className={cn("flex gap-1", showLabel ? "w-full flex-col" : "items-center")}>
        <span className={showLabel ? "text-[12px] text-subtle" : "sr-only"}>{c.label}</span>
        <select
          name={c.name}
          defaultValue={c.value}
          onChange={onChange}
          title={c.label}
          className={cn(inputClass, "h-8 cursor-pointer pr-7 text-[13px]", showLabel ? "w-full" : "w-auto max-w-52", c.value && "border-border-strong")}
        >
          {c.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label
      className={cn(
        "flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[13px] shadow-xs transition-colors select-none",
        c.checked ? "border-accent/30 bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:border-border-strong",
      )}
    >
      <input type="checkbox" name={c.name} value="1" defaultChecked={c.checked} onChange={onChange} className="accent-(--accent)" />
      {c.label}
    </label>
  );
}
