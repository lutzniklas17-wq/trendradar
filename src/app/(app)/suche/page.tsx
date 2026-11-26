import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { requireOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Suche" };

export default async function SearchPage({ searchParams }: PageProps<"/suche">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 200) : "";

  let results: ItemListEntry[] = [];
  let failed = false;
  if (query) {
    const { supabase } = await requireOwner();
    const { data, error } = await supabase.rpc("find_similar_items", { q: query, max_results: 50, min_score: 0.3 });
    failed = !!error;
    results = (data ?? []) as ItemListEntry[];
  }

  return (
    <>
      <PageHeader
        title={query ? `Suche: ${query}` : "Suche"}
        description="Durchsucht alle Entdeckungen, auch bei Tippfehlern. Suchinteresse und Anzeigen kommen mit den Datenquellen dazu."
      />
      <Card>
        {!query ? (
          <EmptyState icon={Search} title="Wonach suchst du?">
            Gib oben einen Begriff ein, z. B. „Red Light Mask“ oder „Creatine Gummies“.
          </EmptyState>
        ) : failed ? (
          <EmptyState icon={Search} title="Suche nicht verfügbar">
            Die Datenbankfunktion fehlt. Bitte Migration 0002 ausführen (siehe README).
          </EmptyState>
        ) : results.length ? (
          <>
            <CardHeader title={`${results.length} Treffer in deinen Entdeckungen`} />
            <ItemList items={results} showArea />
          </>
        ) : (
          <EmptyState icon={Search} title="Keine Treffer">
            Unter „Trend Spy“ kannst du das Produkt selbst erfassen.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
