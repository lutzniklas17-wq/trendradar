import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaItems } from "@/components/areas/area-items";

export const metadata: Metadata = { title: "Future Radar" };

export default async function FutureRadarPage({ searchParams }: PageProps<"/future-radar">) {
  return (
    <>
      <PageHeader
        title="Future Radar"
        description="Themen mit möglichem Zukunftspotenzial aus deinen RSS-Feeds. Eine Bewertung nach festen Kriterien folgt mit der KI-Grundlage, klar als Einschätzung markiert."
      />
      <AreaItems
        area="future_radar"
        path="/future-radar"
        icon={Radar}
        title="Gesammelte Themen"
        description="Titel und Link aus dem Feed. Das sind Signale aus Quellen, keine Bewertung."
        noun={["Thema", "Themen"]}
        params={await searchParams}
      />
    </>
  );
}
