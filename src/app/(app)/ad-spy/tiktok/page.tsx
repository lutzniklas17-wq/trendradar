import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { AdSpyNav } from "@/components/ads/ad-spy-nav";

export const metadata: Metadata = { title: "Ad Spy TikTok" };

export default function TikTokPage() {
  return (
    <>
      <PageHeader title="Ad Spy" description="Anzeigen aus offiziellen Werbebibliotheken." />
      <AdSpyNav active="tiktok" />
      <Card>
        <CardHeader
          title="TikTok-Anzeigen sind hier noch nicht verfügbar"
          description="Es gibt keine offene, zulässige Schnittstelle für TikTok-Anzeigen, die TrendRadar automatisch abfragen dürfte."
          action={<Badge>Nicht verfügbar</Badge>}
        />
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-muted">
          <p>
            TikTok bietet die <span className="text-foreground">Commercial Content API</span> an. Sie liefert nur Anzeigen, die in der EU ausgespielt wurden, und ist für
            Forschung gedacht: Zugang gibt es erst nach einem Antrag und einer Prüfung durch TikTok. Ein privates Recherche-Tool erfüllt das in der Regel nicht.
          </p>
          <p>
            Das TikTok Creative Center und die Webseiten der Werbebibliothek automatisch auszulesen, verbieten die Nutzungsbedingungen. Darum zeigt TrendRadar hier keine
            Daten an, statt etwas Unvollständiges oder Erfundenes.
          </p>
          <p>Was geht: selbst in der offiziellen Bibliothek suchen. Wenn TikTok einen Zugang gewährt, kann dieser Bereich gleich aufgebaut werden wie Meta.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href="https://library.tiktok.com/ads" target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
              TikTok-Werbebibliothek öffnen <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <a href="https://developers.tiktok.com/products/commercial-content-api" target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")}>
              Commercial Content API <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </Card>
    </>
  );
}
