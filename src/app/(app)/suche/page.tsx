import type { Metadata } from "next";
import Form from "next/form";
import { Search } from "lucide-react";
import { BigSearchInput } from "@/components/ui/big-search";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { requireOwner } from "@/lib/auth";
import { AREA_OPTIONS, categoryOptions, matchesText, parseItemFilters, resultLabel } from "@/lib/list-filters";

export const metadata: Metadata = { title: "Suche" };

const TYPE_OPTIONS = [
  { value: "", label: "Alle Typen" },
  { value: "product", label: "Produkte" },
  { value: "brand", label: "Marken" },
  { value: "startup", label: "Start-ups" },
  { value: "ad", label: "Anzeigen" },
  { value: "topic", label: "Themen" },
] as const;

type SearchHit = ItemListEntry & { type?: string };

export default async function SearchPage({ searchParams }: PageProps<"/suche">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const filters = parseItemFilters(params);
  const type = TYPE_OPTIONS.find((t) => t.value === params.typ)?.value ?? "";

  let all: SearchHit[] = [];
  let failed = false;
  if (query) {
    const { supabase } = await requireOwner();
    const { data, error } = await supabase.rpc("find_similar_items", { q: query, max_results: 100, min_score: 0.3 });
    failed = !!error;
    all = (data ?? []) as SearchHit[];
  }
  // Treffer bleiben nach Relevanz sortiert; die Filter grenzen nur ein.
  const results = all.filter(
    (r) =>
      matchesText([r.name, r.category], filters.text) &&
      (!filters.area || r.area === filters.area) &&
      (!filters.category || r.category === filters.category) &&
      (!type || r.type === type),
  );
  const active = Boolean(filters.text || filters.area || filters.category || type);

  return (
    <>
      <PageHeader
        title={query ? `Suche: ${query}` : "Suche"}
        description="Durchsucht alle Entdeckungen, auch bei Tippfehlern. Tipp: Mit Ctrl+K (Mac ⌘K) kommst du von jeder Seite hierher."
      />
      <Form action="/suche" className="mb-6 flex flex-wrap gap-2">
        <BigSearchInput name="q" label="Suchbegriff" defaultValue={query} required maxLength={200} placeholder="Produkt, Marke oder Kategorie, z. B. „Red Light Mask“" autoFocus={!query} />
        <button type="submit" className={buttonClass("primary", "md", "h-12 rounded-xl px-5")}>
          Suchen
        </button>
      </Form>
      <Card>
        {query && all.length ? (
          <FilterBar
            path="/suche"
            keep={{ q: query }}
            query={filters.text}
            queryPlaceholder="In Treffern filtern…"
            active={active}
            resultLabel={resultLabel(results.length, all.length, ["Treffer", "Treffer"])}
            controls={[
              { kind: "select", name: "bereich", label: "Bereich", value: filters.area, options: AREA_OPTIONS },
              { kind: "select", name: "typ", label: "Typ", value: type, options: TYPE_OPTIONS },
              { kind: "select", name: "kategorie", label: "Kategorie", value: filters.category, options: categoryOptions(all) },
            ]}
          />
        ) : null}
        {!query ? (
          <EmptyState icon={Search} title="Wonach suchst du?">
            Gib oben einen Begriff ein, z. B. „Red Light Mask“ oder „Creatine Gummies“.
          </EmptyState>
        ) : failed ? (
          <EmptyState icon={Search} title="Suche nicht verfügbar">
            Die Datenbankfunktion fehlt. Bitte Migration 0002 ausführen (siehe README).
          </EmptyState>
        ) : results.length ? (
          <ItemList items={results} showArea />
        ) : all.length ? (
          <EmptyState icon={Search} title="Keine Treffer für diese Filter">
            Filter lockern oder zurücksetzen.
          </EmptyState>
        ) : (
          <EmptyState icon={Search} title="Keine Treffer">
            Unter „Trend Spy“ kannst du das Produkt selbst erfassen.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
