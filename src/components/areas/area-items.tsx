import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { requireOwner } from "@/lib/auth";
import { categoryOptions, filterItems, hasItemFilters, ITEM_PERIODS, ITEM_SORTS, parseItemFilters, resultLabel } from "@/lib/list-filters";

/**
 * Liste der gesammelten Einträge eines Bereichs (z. B. Startup Spy) mit Filter.
 * Einträge kommen aus den täglichen Datensammlern; jeder hat Quelle und Entdeckungsdatum.
 */
export async function AreaItems({
  area,
  path,
  icon: Icon,
  title,
  description,
  noun,
  params,
}: {
  area: "startup_spy" | "future_radar" | "trend_spy";
  path: string;
  icon: LucideIcon;
  title: string;
  description: string;
  noun: [string, string];
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = parseItemFilters(params);
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("items")
    .select("id, name, category, first_discovered_at, is_new")
    .eq("area", area)
    .order("first_discovered_at", { ascending: false })
    .limit(1000);
  const all = ((data ?? []) as ItemListEntry[]).map((i) => ({ ...i, date: i.first_discovered_at }));
  const items = filterItems(all, filters);

  return (
    <Card>
      <CardHeader title={title} description={description} />
      {all.length ? (
        <FilterBar
          path={path}
          query={filters.text}
          queryPlaceholder="Name, Kategorie…"
          active={hasItemFilters(filters)}
          resultLabel={resultLabel(items.length, all.length, noun)}
          controls={[
            { kind: "select", name: "kategorie", label: "Kategorie", value: filters.category, options: categoryOptions(all) },
            { kind: "select", name: "zeitraum", label: "Entdeckt", value: filters.periodDays ? String(filters.periodDays) : "", options: ITEM_PERIODS },
            { kind: "select", name: "sortierung", label: "Sortierung", value: filters.sort, options: ITEM_SORTS },
          ]}
        />
      ) : null}
      {error ? (
        <EmptyState icon={Icon} title="Datenbank nicht erreichbar">
          Ist die Migration ausgeführt? Siehe README.
        </EmptyState>
      ) : items.length ? (
        <ItemList items={items} />
      ) : all.length ? (
        <EmptyState icon={Icon} title="Keine Einträge für diese Filter">
          <Link href={path} className="text-accent hover:underline">
            Filter zurücksetzen
          </Link>
        </EmptyState>
      ) : (
        <EmptyState icon={Icon} title={`Noch keine ${noun[1]}`}>
          Es werden keine Beispieldaten angezeigt. Einträge kommen über die{" "}
          <Link href="/sammler" className="text-accent hover:underline">
            Datensammler
          </Link>
          .
        </EmptyState>
      )}
    </Card>
  );
}
