import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOwner } from "@/lib/auth";
import { getMetaEnv } from "@/lib/env";
import {
  AD_COUNTRIES,
  AD_PLATFORMS,
  AD_SEARCH_TYPES,
  AD_STATUSES,
  groupByAdvertiser,
  isAdCountry,
  isAdPlatform,
  isAdSearchType,
  isAdStatus,
  librarySearchUrl,
  LONG_RUNNING_DAYS,
  MAX_SEARCH_LENGTH,
  normalizeTerms,
  runningDays,
  validateTerms,
  type AdQuery,
  type MetaAd,
} from "@/lib/ads/meta";
import { searchAds, type AdLookup } from "@/lib/ads/service";
import { trackShop } from "../shop-spy/actions";
import { addWatchTerm } from "../sammler/actions";
import { AdSpyNav } from "@/components/ads/ad-spy-nav";
import { AdCard, AdGrid } from "@/components/ads/ad-card";
import { loadAdCards } from "@/lib/ads/feed";

export const metadata: Metadata = { title: "Ad Spy" };

const dateFmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }) : "unbekannt";

export default async function AdSpyPage({ searchParams }: PageProps<"/ad-spy">) {
  const params = await searchParams;
  const raw = typeof params.q === "string" ? params.q.slice(0, 300) : "";
  const terms = normalizeTerms(raw);
  const query: AdQuery = {
    terms,
    country: isAdCountry(params.land) ? params.land : "DE",
    status: isAdStatus(params.status) ? params.status : "ACTIVE",
    platform: isAdPlatform(params.plattform) ? params.plattform : "",
    searchType: isAdSearchType(params.art) ? params.art : "KEYWORD_UNORDERED",
    after: typeof params.nach === "string" && params.nach.length < 500 ? params.nach : undefined,
  };
  const notice = typeof params.hinweis === "string" ? params.hinweis.slice(0, 300) : null;
  const inputError = raw.trim() ? validateTerms(terms) : null;
  const configured = getMetaEnv() !== null;

  let lookup: AdLookup | null = null;
  if (terms && !inputError) {
    const { supabase } = await requireOwner();
    lookup = await searchAds(supabase, query);
  }

  const countryLabel = AD_COUNTRIES.find((c) => c.code === query.country)?.label ?? query.country;
  const browserLinks = terms ? (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      <a href={librarySearchUrl(terms, query.country)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
        In der Ad Library öffnen ({countryLabel}) <ExternalLink className="size-3" />
      </a>
      <a href={librarySearchUrl(terms, "CH")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
        Schweiz im Browser <ExternalLink className="size-3" />
      </a>
    </span>
  ) : null;

  return (
    <>
      <PageHeader
        title="Ad Spy"
        description="Anzeigen auf Facebook und Instagram aus der offiziellen Meta Ad Library. Abgedeckt sind nur Anzeigen, die in der EU ausgespielt wurden."
      />
      <AdSpyNav active="suche" />
      {notice ? (
        <Card className="mb-6">
          <p className="px-5 py-3 text-sm">
            {notice}{" "}
            <Link href="/ad-spy/rangliste" className="text-accent hover:underline">
              Zur Rangliste
            </Link>
          </p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3 p-5">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Suchbegriff (Text der Anzeige)</span>
            <input name="q" defaultValue={raw} required maxLength={MAX_SEARCH_LENGTH} className={inputClass} placeholder="z. B. led maske" />
          </label>
          <Select name="land" label="Land (EU)" value={query.country} options={AD_COUNTRIES.map((c) => ({ value: c.code, label: c.label }))} />
          <Select name="status" label="Status" value={query.status} options={AD_STATUSES} />
          <Select name="plattform" label="Plattform" value={query.platform} options={AD_PLATFORMS} />
          <Select name="art" label="Suche" value={query.searchType} options={AD_SEARCH_TYPES} />
          <Button type="submit">Suchen</Button>
        </form>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Meta übersetzt Suchbegriffe nicht: für Deutschland deutsch suchen, für Frankreich französisch. Die Schweiz liefert die API
          für Produktanzeigen nicht; dafür gibt es den Link zur Ad Library im Browser.
          {configured ? null : " Die Meta-API ist noch nicht verbunden (siehe unten)."}
        </p>
      </Card>

      {inputError ? (
        <Card>
          <EmptyState icon={Megaphone} title="Eingabe prüfen">
            {inputError}
          </EmptyState>
        </Card>
      ) : !lookup ? (
        configured ? (
          <Card>
            <EmptyState icon={Megaphone} title="Noch keine Suche">
              Suche nach einem Produkt oder Begriff. Die Abfrage bei Meta ist kostenlos; Meta begrenzt aber die Anzahl Abfragen pro Stunde.
            </EmptyState>
          </Card>
        ) : (
          <NotConfigured links={browserLinks} />
        )
      ) : lookup.status === "not_configured" ? (
        <NotConfigured links={browserLinks} />
      ) : lookup.status === "error" ? (
        <Card>
          <EmptyState icon={Megaphone} title="Suche fehlgeschlagen">
            {lookup.message}
            {browserLinks ? <div className="mt-3 flex justify-center text-xs">{browserLinks}</div> : null}
          </EmptyState>
        </Card>
      ) : (
        <Results lookup={lookup} query={query} countryLabel={countryLabel} browserLinks={browserLinks} />
      )}
    </>
  );
}

async function Results({
  lookup,
  query,
  countryLabel,
  browserLinks,
}: {
  lookup: Extract<AdLookup, { status: "ok" }>;
  query: AdQuery;
  countryLabel: string;
  browserLinks: React.ReactNode;
}) {
  const { ads, nextCursor } = lookup.result;
  const now = new Date(lookup.fetchedAt);
  const groups = groupByAdvertiser(ads, now).filter((g) => g.count > 1);
  // Gespeicherte Treffer als Karten (mit Vorschau und Analyse), nicht gespeicherte als einfache Zeile.
  const { supabase } = await requireOwner();
  const internal = ads.map((a) => lookup.ids[a.id]).filter((x): x is string => Boolean(x));
  const { cards } = await loadAdCards(supabase, internal, new Map(internal.map((id) => [id, [query.country]])));
  const shown = new Set(cards.map((c) => c.external_id));
  const leftovers = ads.filter((a) => !shown.has(a.id));
  const canEmbed = Boolean(getMetaEnv());
  const nextHref = nextCursor
    ? `/ad-spy?${new URLSearchParams({ q: query.terms, land: query.country, status: query.status, plattform: query.platform, art: query.searchType, nach: nextCursor })}`
    : null;

  return (
    <div className="space-y-6">
      {groups.length ? (
        <Card>
          <CardHeader
            title="Werbetreibende mit mehreren Anzeigen (auf dieser Seite)"
            description="Viele gleichzeitige Anzeigen deuten auf Tests oder Skalierung hin. Das ist ein Signal, kein Beleg für Umsatz."
            action={<Badge tone="accent">Signal</Badge>}
          />
          <ul className="divide-y divide-border">
            {groups.slice(0, 8).map((g) => (
              <li key={g.pageId ?? g.pageName} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{g.pageName}</span>
                <span className="flex flex-wrap items-center gap-3 text-muted">
                  {g.count} Anzeigen{g.longestDays !== null ? ` · längste läuft ${g.longestDays} Tage` : ""}
                  {g.pageId ? <TrackShopButton pageId={g.pageId} name={g.pageName} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={`${ads.length} Anzeigen · ${countryLabel} · „${query.terms}“`}
          description={`Abgefragt am ${now.toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}${lookup.saved ? "" : " · Speichern in der Datenbank fehlgeschlagen"}`}
          action={
            <span className="flex flex-wrap items-center gap-3">
              <WatchTermButton terms={query.terms} country={query.country} />
              <ProvenanceBadge kind="data" />
            </span>
          }
        />
        {ads.length ? (
          <div className="border-b border-border bg-background p-4">
            <AdGrid>
              {cards.map((c) => (
                <AdCard key={c.id} ad={c} canEmbed={canEmbed} />
              ))}
            </AdGrid>
            {leftovers.length ? (
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
                {leftovers.map((ad) => (
                  <AdRow key={ad.id} ad={ad} now={now} />
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <EmptyState icon={Megaphone} title="Keine Anzeigen gefunden">
            Meta hat für diese Suche in {countryLabel} keine Anzeigen geliefert. Andere Schreibweise oder Sprache versuchen.
          </EmptyState>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted">
          <span>Quelle: Meta Ad Library API. Ausgaben und Umsatz veröffentlicht Meta für Produktanzeigen nicht.</span>
          {browserLinks}
          {nextHref ? (
            <Link href={nextHref} className="font-medium text-accent hover:underline">
              Weitere Anzeigen laden →
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function AdRow({ ad, now }: { ad: MetaAd; now: Date }) {
  const days = runningDays(ad, now);
  const text = ad.bodies[0];
  return (
    <li className="space-y-2 px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{ad.pageName ?? "Unbekannte Seite"}</span>
          {ad.pageId ? <TrackShopButton pageId={ad.pageId} name={ad.pageName ?? ""} /> : null}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {ad.platforms.map((p) => (
            <Badge key={p}>{p.charAt(0) + p.slice(1).toLowerCase().replace("_", " ")}</Badge>
          ))}
          {days !== null && days >= LONG_RUNNING_DAYS ? (
            <Badge tone="accent" title={`Läuft seit mindestens ${LONG_RUNNING_DAYS} Tagen. Lange Laufzeit ist ein Signal, dass sich die Anzeige lohnt, aber kein Beweis.`}>
              Signal: lange Laufzeit
            </Badge>
          ) : null}
        </span>
      </div>
      {ad.linkTitles[0] ? <p className="font-medium">{ad.linkTitles[0]}</p> : null}
      {text ? <p className="line-clamp-4 whitespace-pre-line text-muted">{text}</p> : <p className="text-muted italic">Kein Anzeigentext geliefert (oft bei reinen Bild- oder Videoanzeigen).</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Start {dateFmt(ad.startedAt)}
          {ad.stoppedAt ? ` · Ende ${dateFmt(ad.stoppedAt)}` : " · läuft noch"}
          {days !== null ? ` · ${days} Tage` : ""}
        </span>
        {ad.euReach !== null ? <span title="Geschätzte Anzahl erreichter Personen in der EU laut Meta">Reichweite EU {ad.euReach.toLocaleString("de-CH")}</span> : null}
        {ad.linkCaptions[0] ? <span>{ad.linkCaptions[0]}</span> : null}
        {ad.bodies.length > 1 ? <span>{ad.bodies.length} Textvarianten</span> : null}
        <a href={ad.libraryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
          Anzeige mit Bild/Video ansehen <ExternalLink className="size-3" />
        </a>
      </div>
    </li>
  );
}

/** Suchbegriff in den täglichen Sammellauf aufnehmen: daraus entsteht die Rangliste. */
function WatchTermButton({ terms, country }: { terms: string; country: string }) {
  return (
    <form action={addWatchTerm}>
      <input type="hidden" name="begriff" value={terms} />
      <input type="hidden" name="land" value={country} />
      <input type="hidden" name="zurueck" value={`/ad-spy?${new URLSearchParams({ q: terms, land: country })}`} />
      <button type="submit" className="text-xs font-medium text-accent hover:underline" title="Jeden Tag automatisch die aktiven Anzeigen zu diesem Begriff sammeln">
        Täglich sammeln
      </button>
    </form>
  );
}

/** Werbetreibenden im Shop Spy verfolgen: aktive Anzeigen werden ab jetzt täglich gezählt. */
function TrackShopButton({ pageId, name }: { pageId: string; name: string }) {
  return (
    <form action={trackShop}>
      <input type="hidden" name="seite" value={pageId} />
      <input type="hidden" name="name" value={name} />
      <button type="submit" className="text-xs font-medium text-accent hover:underline">
        Shop verfolgen
      </button>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select name={name} defaultValue={value} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NotConfigured({ links }: { links: React.ReactNode }) {
  return (
    <Card>
      <EmptyState icon={Megaphone} title="Meta Ad Library API ist noch nicht verbunden">
        Es werden keine Beispieldaten angezeigt. Sobald META_ACCESS_TOKEN in Vercel gesetzt ist, erscheinen hier echte Anzeigen
        (Anleitung im README, Abschnitt „Meta Ad Spy“). Bis dahin kannst du direkt in der Ad Library suchen.
        {links ? <div className="mt-3 flex justify-center text-xs">{links}</div> : null}
      </EmptyState>
    </Card>
  );
}
