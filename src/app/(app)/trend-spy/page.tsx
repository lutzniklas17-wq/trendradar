import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateProductForm } from "@/components/product/create-product-form";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { FilterBar } from "@/components/ui/filter-bar";
import { requireOwner } from "@/lib/auth";
import { categoryOptions, filterItems, hasItemFilters, ITEM_PERIODS, ITEM_SORTS, parseItemFilters, resultLabel } from "@/lib/list-filters";

export const metadata: Metadata = { title: "Trend Spy" };

const PLANNED_SOURCES = [
  { name: "Google Trends (DataForSEO)", note: "Steigende Suchanfragen je Kategorie und Land" },
  { name: "Meta Ad Library", note: "Neue und lange laufende Anzeigen je Kategorie" },
  { name: "Product Hunt, Hacker News", note: "Neue Produktlaunches" },
  { name: "Claude Websuche", note: "Einordnung, Duplikate, Begründung" },
];

export default async function TrendSpyPage({ searchParams }: PageProps<"/trend-spy">) {
  const filters = parseItemFilters(await searchParams);
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("items")
    .select("id, name, category, first_discovered_at, is_new")
    .eq("area", "trend_spy")
    .eq("type", "product")
    .order("first_discovered_at", { ascending: false })
    .limit(1000);
  const all = ((data ?? []) as ItemListEntry[]).map((i) => ({ ...i, date: i.first_discovered_at }));
  const items = filterItems(all, filters);

  return (
    <>
      <PageHeader title="Trend Spy" description="Produkte und Nischen, die gerade an Aufmerksamkeit gewinnen." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Produkte"
            description="Automatische Entdeckungen kommen mit der täglichen Recherche dazu. Bis dahin erfasst du Produkte selbst."
          />
          {all.length ? (
            <FilterBar
              path="/trend-spy"
              query={filters.text}
              queryPlaceholder="Name, Kategorie…"
              active={hasItemFilters(filters)}
              resultLabel={resultLabel(items.length, all.length, ["Produkt", "Produkte"])}
              controls={[
                { kind: "select", name: "kategorie", label: "Kategorie", value: filters.category, options: categoryOptions(all) },
                { kind: "select", name: "zeitraum", label: "Entdeckt", value: filters.periodDays ? String(filters.periodDays) : "", options: ITEM_PERIODS },
                { kind: "select", name: "sortierung", label: "Sortierung", value: filters.sort, options: ITEM_SORTS },
                { kind: "toggle", name: "neu", label: "Nur neue", checked: filters.onlyNew },
              ]}
            />
          ) : null}
          {error ? (
            <EmptyState icon={Flame} title="Datenbank nicht erreichbar">
              Ist die Migration ausgeführt? Siehe README.
            </EmptyState>
          ) : items.length ? (
            <ItemList items={items} />
          ) : all.length ? (
            <EmptyState icon={Flame} title="Keine Produkte für diese Filter">
              Filter lockern oder zurücksetzen.
            </EmptyState>
          ) : (
            <EmptyState icon={Flame} title="Noch keine Produkte">
              Es werden keine Beispieldaten angezeigt. Lege rechts dein erstes Produkt an.
            </EmptyState>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Produkt erfassen" description="Mit Duplikatprüfung gegen bestehende Einträge." />
            <CreateProductForm />
          </Card>
          <Card>
            <CardHeader title="Geplante automatische Quellen" />
            <ul className="divide-y divide-border">
              {PLANNED_SOURCES.map((s) => (
                <li key={s.name} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted">{s.note}</p>
                  </div>
                  <Badge>geplant</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
