import type { Metadata } from "next";
import { LineChart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaPlaceholder } from "@/components/areas/area-placeholder";

export const metadata: Metadata = { title: "Google Trends" };

export default function GoogleTrendsPage() {
  return (
    <>
      <PageHeader
        title="Google Trends"
        description="Relatives Suchinteresse (0–100), Regionen, verwandte und steigende Suchanfragen."
      />
      <AreaPlaceholder
        icon={LineChart}
        title="Trend-Abfragen folgen als Nächstes"
        phase="Phase 3"
        sources={[
          { name: "DataForSEO Google Trends", note: "Hauptquelle, günstig im Hintergrund" },
          { name: "SerpApi", note: "Gratis-Stufe als Reserve" },
        ]}
      />
    </>
  );
}
