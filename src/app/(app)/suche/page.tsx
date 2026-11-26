import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Suche" };

export default async function SearchPage({ searchParams }: PageProps<"/suche">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  return (
    <>
      <PageHeader
        title={query ? `Suche: ${query}` : "Suche"}
        description="Führt Produkte, Anzeigen, Suchinteresse, Start-ups und Einschätzungen zu einem Begriff zusammen."
      />
      <Card>
        <EmptyState icon={Search} title={query ? "Noch keine Datenquellen angebunden" : "Wonach suchst du?"}>
          {query
            ? "Sobald Google Trends, Meta Ad Library und die Recherche angebunden sind, erscheinen hier die Ergebnisse, getrennt nach Bereichen."
            : "Gib oben einen Begriff ein, z. B. „Red Light Mask“ oder „Creatine Gummies“."}
        </EmptyState>
      </Card>
    </>
  );
}
