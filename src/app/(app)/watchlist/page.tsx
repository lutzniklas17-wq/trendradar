import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemList, type ItemListEntry } from "@/components/product/item-list";
import { requireOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Watchlist" };

type Row = { note: string | null; added_at: string; items: Omit<ItemListEntry, "note"> | null };

export default async function WatchlistPage() {
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("watchlist")
    .select("note, added_at, items(id, name, category, area, first_discovered_at)")
    .order("added_at", { ascending: false });
  const items = ((data ?? []) as unknown as Row[])
    .filter((r) => r.items)
    .map((r) => ({ ...r.items!, note: r.note }));

  return (
    <>
      <PageHeader title="Watchlist" description="Gespeicherte Produkte, Marken und Trends zum Beobachten und Vergleichen." />
      <Card>
        {items.length ? (
          <ItemList items={items} showArea />
        ) : (
          <EmptyState icon={Bookmark} title="Noch nichts gespeichert">
            Über „Zur Watchlist“ auf jeder Produktseite landet ein Eintrag hier.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
