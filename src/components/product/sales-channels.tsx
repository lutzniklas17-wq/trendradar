import { ExternalLink, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { SALES_CHANNELS } from "@/lib/platforms";

export function SalesChannels({ query }: { query: string }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-medium">Verkaufskanäle</h2>
        <p className="text-sm text-muted">
          Wo du verkaufen könntest. Gebühren ändern sich und hängen von Land und Kategorie ab: bitte auf der offiziellen
          Seite nachlesen und im Rechner unter Shop- / Plattformgebühr eintragen.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SALES_CHANNELS.map((c) => (
          <Card key={c.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <PlatformLogo icon={c.icon} monogram={c.monogram} color={c.color} name={c.name} />
              <p className="text-sm font-medium">{c.name}</p>
            </div>
            <p className="flex-1 text-sm text-muted">{c.description}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {c.feesUrl ? (
                <a
                  href={c.feesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 hover:bg-surface-muted"
                >
                  <ExternalLink className="size-3.5" aria-hidden /> Offizielle Gebühren
                </a>
              ) : null}
              {c.searchUrl ? (
                <a
                  href={c.searchUrl(query)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 hover:bg-surface-muted"
                >
                  <Search className="size-3.5" aria-hidden /> Konkurrenz ansehen
                </a>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
