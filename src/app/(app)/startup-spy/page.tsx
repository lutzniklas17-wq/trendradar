import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaPlaceholder } from "@/components/areas/area-placeholder";

export const metadata: Metadata = { title: "Startup Spy" };

export default function StartupSpyPage() {
  return (
    <>
      <PageHeader title="Startup Spy" description="Neue Unternehmen, D2C-Marken und Produktlaunches." />
      <AreaPlaceholder
        icon={Rocket}
        title="Noch keine Start-ups entdeckt"
        phase="Phase 4"
        sources={[
          { name: "Claude Websuche", note: "Neue Marken und Start-ups mit Quellenangabe" },
          { name: "Product Hunt API", note: "Tägliche Launches" },
          { name: "Hacker News API", note: "Show HN" },
          { name: "RSS-Feeds", note: "Fach- und Innovationsportale" },
        ]}
      />
    </>
  );
}
