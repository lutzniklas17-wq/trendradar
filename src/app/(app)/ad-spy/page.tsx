import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaPlaceholder } from "@/components/areas/area-placeholder";

export const metadata: Metadata = { title: "Ad Spy" };

export default function AdSpyPage() {
  return (
    <>
      <PageHeader title="Ad Spy" description="Anzeigen aus offiziellen Werbebibliotheken, mit Laufzeit und Advertiser." />
      <AreaPlaceholder
        icon={Megaphone}
        title="Noch keine Anzeigen geladen"
        phase="Phase 3"
        sources={[
          { name: "Meta Ad Library API", note: "Facebook und Instagram, Anzeigen mit EU-Ausspielung" },
          { name: "TikTok Commercial Content API", note: "Nur EU, nach erfolgreicher Bewerbung" },
          { name: "Direktlinks", note: "TikTok Creative Center und Meta Ad Library im Browser" },
        ]}
      />
    </>
  );
}
