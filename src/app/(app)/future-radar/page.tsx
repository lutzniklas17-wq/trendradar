import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaItems } from "@/components/areas/area-items";
import { Card } from "@/components/ui/card";
import { RadarTopics } from "@/components/radar/radar-topics";

export const metadata: Metadata = { title: "Future Radar" };

export default async function FutureRadarPage({ searchParams }: PageProps<"/future-radar">) {
  const params = await searchParams;
  const notice = typeof params.hinweis === "string" ? params.hinweis.slice(0, 300) : null;
  return (
    <>
      <PageHeader
        title="Future Radar"
        description="E-Commerce-Themen mit möglichem Zukunftspotenzial. Getrennt: Fakten (gezählt, mit Quelle), Signal (Veränderung) und Einschätzung (Regel, klar markiert)."
      />
      {notice ? (
        <Card className="mb-6 border-accent/40">
          <p className="px-5 py-3 text-sm">{notice}</p>
        </Card>
      ) : null}
      <div className="space-y-6">
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
