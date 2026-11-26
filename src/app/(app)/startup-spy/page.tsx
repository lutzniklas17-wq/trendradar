import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StartupList } from "@/components/startups/startup-list";

export const metadata: Metadata = { title: "Startup Spy" };

export default async function StartupSpyPage({ searchParams }: PageProps<"/startup-spy">) {
  return (
    <>
      <PageHeader
        title="Startup Spy"
        description="Kleine, gerade gestartete E-Commerce-Marken: neue Shops aus der Meta Ad Library, Launches von Product Hunt und deine RSS-Feeds. Industrie, Öl, Finanzen und B2B-Software werden ausgefiltert."
      />
      <StartupList params={await searchParams} />
    </>
  );
}
