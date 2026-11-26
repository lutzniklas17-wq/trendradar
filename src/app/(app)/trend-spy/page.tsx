import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaPlaceholder } from "@/components/areas/area-placeholder";

export const metadata: Metadata = { title: "Trend Spy" };

export default function TrendSpyPage() {
  return (
    <>
      <PageHeader title="Trend Spy" description="Produkte und Nischen, die gerade an Aufmerksamkeit gewinnen." />
      <AreaPlaceholder
        icon={Flame}
        title="Noch keine Trend-Entdeckungen"
        phase="Phase 3 und 4"
        sources={[
          { name: "Google Trends (DataForSEO)", note: "Steigende Suchanfragen je Kategorie und Land" },
          { name: "Meta Ad Library", note: "Neue und lange laufende Anzeigen je Kategorie" },
          { name: "Product Hunt, Hacker News", note: "Neue Produktlaunches" },
          { name: "Claude Websuche", note: "Einordnung, Duplikate, Begründung" },
        ]}
      />
    </>
  );
}
