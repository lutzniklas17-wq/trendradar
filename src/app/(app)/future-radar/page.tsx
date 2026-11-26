import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaPlaceholder } from "@/components/areas/area-placeholder";

export const metadata: Metadata = { title: "Future Radar" };

export default function FutureRadarPage() {
  return (
    <>
      <PageHeader
        title="Future Radar"
        description="Einschätzungen zu Produkten mit Zukunftspotenzial, getrennt nach Fakten, Signalen und Einschätzung."
      />
      <AreaPlaceholder
        icon={Radar}
        title="Future Radar startet nach einigen Wochen gesammelter Signale"
        phase="nach dem MVP"
        sources={[
          { name: "Alle Signale aus TrendRadar", note: "Suchtrend, Anzeigen, Launches, Länder" },
          { name: "Claude", note: "Bewertung nach festen Kriterien, klar als Einschätzung markiert" },
        ]}
      />
    </>
  );
}
