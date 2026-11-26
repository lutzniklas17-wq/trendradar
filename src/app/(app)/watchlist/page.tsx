import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { requireOwner } from "@/lib/auth";
import { AREA_OPTIONS, categoryOptions, filterItems, hasItemFilters, ITEM_PERIODS, parseItemFilters, resultLabel } from "@/lib/list-filters";

export const metadata: Metadata = { title: "Watchlist" };

type Row = { note: string | null; added_at: string; items: Omit<ItemListEntry, "note"> | null };

const WATCHLIST_SORTS = [
  { value: "", label: "Zuletzt gespeichert" },
  { value: "alt", label: "Zuerst gespeichert" },
  { value: "name", label: "Name A–Z" },
] as const;

const PERIODS = ITEM_PERIODS.map((p) => (p.value ? { ...p, label: p.label.replace("Letzte", "Gespeichert in den letzten") } : p));

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const filters = parseItemFilters(await searchParams);
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("watchlist")
    .select("note, added_at, items(id, name, category, area, first_discovered_at)")
    .order("added_at", { ascending: false });
  const all = ((data ?? []) as unknown as Row[])
    .filter((r) => r.items)
    .map((r) => ({ ...r.items!, note: r.note, date: r.added_at }));
  const items = filterItems(all, filters);

  return (
    <>
      <PageHeader title="Watchlist" description="Gespeicherte Produkte, Marken und Trends zum Beobachten und Vergleichen." />
      <Card>
        {all.length ? (
          <FilterBar
            path="/watchlist"
            query={filters.text}
            queryPlaceholder="Name, Kategorie, Notiz…"
            active={hasItemFilters(filters)}
            resultLabel={resultLabel(items.length, all.length)}
            controls={[
              { kind: "select", name: "bereich", label: "Bereich", value: filters.area, options: AREA_OPTIONS },
              { kind: "select", name: "kategorie", label: "Kategorie", value: filters.category, options: categoryOptions(all) },
              { kind: "select", name: "zeitraum", label: "Gespeichert", value: filters.periodDays ? String(filters.periodDays) : "", options: PERIODS },
              { kind: "select", name: "sortierung", label: "Sortierung", value: filters.sort, options: WATCHLIST_SORTS },
            ]}
          />
        ) : null}
        {error ? (
          <EmptyState icon={Bookmark} title="Watchlist nicht erreichbar">
            Ist die Migration ausgeführt? Siehe README.
          </EmptyState>
        ) : items.length ? (
          <ItemList items={items} showArea />
        ) : all.length ? (
          <EmptyState icon={Bookmark} title="Keine Einträge für diese Filter">
            Filter lockern oder zurücksetzen.
          </EmptyState>
        ) : (
          <EmptyState icon={Bookmark} title="Noch nichts gespeichert">
            Über „Zur Watchlist“ auf jeder Produktseite landet ein Eintrag hier.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
