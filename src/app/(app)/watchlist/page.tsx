import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  return (
    <>
      <PageHeader title="Watchlist" description="Gespeicherte Produkte, Marken und Trends zum Beobachten und Vergleichen." />
      <Card>
        <EmptyState icon={Bookmark} title="Noch nichts gespeichert">
          Über das Lesezeichen auf jeder Entdeckung landet sie hier.
        </EmptyState>
      </Card>
    </>
  );
}
