import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AreaItems } from "@/components/areas/area-items";

export const metadata: Metadata = { title: "Startup Spy" };

export default async function StartupSpyPage({ searchParams }: PageProps<"/startup-spy">) {
  return (
    <>
      <PageHeader title="Startup Spy" description="Neue D2C-Marken und Produktlaunches aus Product Hunt und deinen RSS-Feeds." />
      <AreaItems
        area="startup_spy"
        path="/startup-spy"
        icon={Rocket}
        title="Launches und neue Marken"
        description="Täglich gesammelt. Product Hunt ist überwiegend Software; gespeichert werden nur Launches mit Konsum-Themen. Grösse und Gründungsdatum liefert die Quelle nicht, „neu“ heisst hier: neu gelauncht."
        noun={["Eintrag", "Einträge"]}
        params={await searchParams}
      />
    </>
  );
}
