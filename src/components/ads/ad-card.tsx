import Link from "next/link";
import { CalendarDays, ExternalLink, Eye, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { AdPreview } from "@/components/ads/ad-preview";
import { domainUrl, runningDays, type AdCardData } from "@/lib/ads/feed";
import { libraryUrl } from "@/lib/ads/meta";
import { adSignals } from "@/lib/ads/verdict";
import { cn } from "@/lib/utils";

const PLATFORM_SHORT: Record<string, string> = { FACEBOOK: "FB", INSTAGRAM: "IG", MESSENGER: "MSG", AUDIENCE_NETWORK: "AN", THREADS: "TH" };
const PLATFORM_LONG: Record<string, string> = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", MESSENGER: "Messenger", AUDIENCE_NETWORK: "Audience Network", THREADS: "Threads" };

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Zurich" }) : "unbekannt";
export const fmtNumber = (n: number) => new Intl.NumberFormat("de-CH", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

/** Kürzel aus dem Namen, statt eines Logos (die API liefert keine Bilder). */
export function Monogram({ name, className }: { name: string | null; className?: string }) {
  const letters = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted text-[11px] font-medium text-muted", className)} aria-hidden>
      {letters || "?"}
    </span>
  );
}

export function AdCreativeText({ ad, large = false }: { ad: Pick<AdCardData, "title" | "body">; large?: boolean }) {
  return (
    <div className={cn("space-y-2", large ? "text-sm" : "text-[13px]")}>
      {ad.title ? <p className="font-medium text-foreground">{ad.title}</p> : null}
      {ad.body ? (
        <p className={cn("whitespace-pre-line text-muted", large ? "" : "line-clamp-[12]")}>{ad.body}</p>
      ) : (
        <p className="text-muted italic">Kein Anzeigentext gespeichert.</p>
      )}
    </div>
  );
}

/** Anzeigen-Karte im Raster: Werbetreibender, Laufzeit, Reichweite, Vorschau, Shop-Link, Analyse. */
export function AdCard({ ad, canEmbed, rank }: { ad: AdCardData; canEmbed: boolean; rank?: number }) {
  const days = runningDays(ad.started_at, ad.stopped_at);
  const running = !ad.stopped_at;
  const shop = domainUrl(ad.domain);
  const countries = ad.countries ?? [];
  const library = libraryUrl(ad.external_id);
  const signals = adSignals(ad);

  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-surface shadow-xs">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Monogram name={ad.advertiser_name} />
        <div className="min-w-0 flex-1">
          {ad.advertiser_id ? (
            <Link
              href={`/ad-spy/rangliste?${new URLSearchParams({ werbetreibender: ad.advertiser_id, zeitraum: "30" })}`}
              className="block truncate text-sm font-medium transition-colors duration-150 hover:text-accent"
            >
              {ad.advertiser_name ?? "Unbekannte Seite"}
            </Link>
          ) : (
            <p className="truncate text-sm font-medium">{ad.advertiser_name ?? "Unbekannte Seite"}</p>
          )}
          {ad.stats ? (
            <p className="text-[12px] text-muted tabular-nums" title="Nur Anzeigen, die TrendRadar selbst gesehen hat. Die vollständige Zahl zeigt der Shop Spy.">
              {ad.stats.active} laufend / {ad.stats.total} bekannt
            </p>
          ) : null}
        </div>
        {rank ? <span className="text-[12px] text-subtle tabular-nums">#{rank}</span> : null}
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-[12px] text-muted">
        <span className={cn("inline-flex items-center gap-1.5 font-medium tabular-nums", running ? "text-positive" : "text-muted")}>
          <span className={cn("size-1.5 rounded-full", running ? "bg-positive" : "bg-subtle")} aria-hidden />
          {days !== null ? `${days} T ${running ? "aktiv" : "gelaufen"}` : running ? "aktiv" : "beendet"}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarDays className="size-3.5" aria-hidden />
          {fmtDate(ad.started_at)} → {running ? "heute" : fmtDate(ad.stopped_at)}
        </span>
        {signals.length ? (
          <span className="ml-auto flex gap-1">
            {signals.map((s) => (
              <Badge key={s.key} tone={s.tone} title={s.title}>
                {s.label}
              </Badge>
            ))}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        {countries.slice(0, 3).map((c) => (
          <Badge key={c} title={c === "EU" ? "In der EU-Zählung des Shop Spy gesehen" : "Hier aktiv gesehen"}>
            {c}
          </Badge>
        ))}
        {countries.length > 3 ? <Badge title={countries.slice(3).join(", ")}>+{countries.length - 3}</Badge> : null}
        {ad.eu_reach !== null ? (
          <Badge title="EU-Reichweite laut Meta (Personen, die die Anzeige gesehen haben)">
            <Eye className="size-3" aria-hidden /> <span className="tabular-nums">{fmtNumber(ad.eu_reach)}</span>
          </Badge>
        ) : null}
        <span className="ml-auto flex gap-1">
          {(ad.publisher_platforms ?? []).map((p) => (
            <Badge key={p} title={PLATFORM_LONG[p] ?? p}>
              {PLATFORM_SHORT[p] ?? p}
            </Badge>
          ))}
        </span>
      </div>

      <div className="px-4 py-3">
        <AdPreview adId={ad.id} canEmbed={canEmbed} libraryHref={library} className="aspect-[4/5]">
          <AdCreativeText ad={ad} />
        </AdPreview>
      </div>

      <div className="mt-auto space-y-2 px-4 pb-4">
        <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-[12px]">
          <Link2 className="size-3.5 shrink-0 text-subtle" aria-hidden />
          {shop ? (
            <a href={shop} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1 text-muted transition-colors duration-150 hover:text-foreground">
              <span className="truncate">{ad.domain}</span>
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="truncate text-subtle" title="Meta liefert die Ziel-URL nicht; die Domain stammt aus der Link-Beschriftung.">
              Keine Shop-Domain erkannt
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/ad-spy/anzeige/${ad.id}`} className={buttonClass("secondary", "sm", "flex-1")}>
            Anzeige analysieren
          </Link>
          <a href={library} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm", "w-8 px-0")} title="In der Meta Ad Library öffnen" aria-label="In der Meta Ad Library öffnen">
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}

export function AdGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
