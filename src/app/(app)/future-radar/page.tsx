import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { BrowseHeader } from "@/components/layout/browse-header";
import { AreaItems } from "@/components/areas/area-items";
import { Card } from "@/components/ui/card";
import { RadarTopics } from "@/components/radar/radar-topics";
import { RadarSuggestions } from "@/components/radar/radar-suggestions";

export const metadata: Metadata = { title: "Future Radar" };

export default async function FutureRadarPage({ searchParams }: PageProps<"/future-radar">) {
  const params = await searchParams;
  const notice = typeof params.hinweis === "string" ? params.hinweis.slice(0, 300) : null;
  return (
    <>
      <BrowseHeader icon={Radar} title="Future" accent="Radar" description="Themen mit Zukunftspotenzial, die TrendRadar in deinen Daten findet und beobachtet." />
      {notice ? (
        <Card className="mb-6 border-accent/40">
          <p className="px-5 py-3 text-sm">{notice}</p>
        </Card>
      ) : null}
      <div className="space-y-6">
        <RadarSuggestions />
        <RadarTopics params={params} />
        <AreaItems
          area="future_radar"
          path="/future-radar"
          icon={Radar}
          title="Gesammelte Themen aus Feeds"
          description="Titel und Link aus deinen RSS-Feeds mit Bereich „Future Radar“. Ausgeschlossene Branchen (Öl, Finanzen, B2B-Software …) werden nicht gespeichert. Das sind Signale aus Quellen, keine Bewertung."
          noun={["Thema", "Themen"]}
          params={params}
        />
      </div>
    </>
  );
}
