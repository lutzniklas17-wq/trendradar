import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateProductForm } from "@/components/product/create-product-form";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { requireOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Trend Spy" };

const PLANNED_SOURCES = [
  { name: "Google Trends (DataForSEO)", note: "Steigende Suchanfragen je Kategorie und Land" },
  { name: "Meta Ad Library", note: "Neue und lange laufende Anzeigen je Kategorie" },
  { name: "Product Hunt, Hacker News", note: "Neue Produktlaunches" },
  { name: "Claude Websuche", note: "Einordnung, Duplikate, Begründung" },
];

export default async function TrendSpyPage() {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("items")
    .select("id, name, category, first_discovered_at, is_new")
    .eq("area", "trend_spy")
    .eq("type", "product")
    .order("first_discovered_at", { ascending: false })
    .limit(200);
  const items = (data ?? []) as ItemListEntry[];

  return (
    <>
      <PageHeader title="Trend Spy" description="Produkte und Nischen, die gerade an Aufmerksamkeit gewinnen." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Produkte"
            description="Automatische Entdeckungen kommen mit der täglichen Recherche dazu. Bis dahin erfasst du Produkte selbst."
          />
          {error ? (
            <EmptyState icon={Flame} title="Datenbank nicht erreichbar">
              Ist die Migration ausgeführt? Siehe README.
            </EmptyState>
          ) : items.length ? (
            <ItemList items={items} />
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
