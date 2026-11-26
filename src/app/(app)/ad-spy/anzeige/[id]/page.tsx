import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, Megaphone, Store, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { AdPreview } from "@/components/ads/ad-preview";
import { AdCard, AdCreativeText, AdGrid, fmtDate, fmtNumber, Monogram } from "@/components/ads/ad-card";
import { requireOwner } from "@/lib/auth";
import { getMetaEnv } from "@/lib/env";
import { adsOfAdvertiser, domainUrl, loadAdCards, runningDays, similarAdsOfOthers } from "@/lib/ads/feed";
import { libraryPageUrl, libraryUrl } from "@/lib/ads/meta";
import { cn } from "@/lib/utils";
import { trackShop } from "../../../shop-spy/actions";

export const metadata: Metadata = { title: "Anzeige analysieren" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS = [
  { value: "shop", label: "Anzeigen dieses Shops" },
  { value: "andere", label: "Ähnliche Anzeigen anderer Shops" },
] as const;

export default async function AdDetailPage({ params, searchParams }: PageProps<"/ad-spy/anzeige/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const tab = sp.ansicht === "andere" ? "andere" : "shop";
  const { supabase } = await requireOwner();

  const [{ cards }, sightingsRes] = await Promise.all([
    loadAdCards(supabase, [id]),
    supabase.from("ad_sightings").select("country, day").eq("ad_id", id).order("day", { ascending: false }).limit(500),
  ]);
  const ad = cards[0];
  if (!ad) notFound();

  const sightings = (sightingsRes.data ?? []) as { country: string; day: string }[];
  const countries = [...new Set(sightings.map((s) => s.country))].sort();
  const lastSeen = sightings[0]?.day ?? null;
  const days = runningDays(ad.started_at, ad.stopped_at);
  const running = !ad.stopped_at;
  const canEmbed = Boolean(getMetaEnv());
  const shopUrl = domainUrl(ad.domain);

  // Shop-Info: nur gemessene Werte aus der eigenen Datenbank.
  const [shopRes, knownRes, termsRes, related] = await Promise.all([
    ad.page_id ? supabase.from("tracked_shops").select("id, name").eq("platform", "meta").eq("page_id", ad.page_id).maybeSingle() : Promise.resolve({ data: null }),
    ad.advertiser_id
      ? supabase.from("ads").select("started_at, eu_reach").eq("advertiser_id", ad.advertiser_id).limit(10_000)
      : Promise.resolve({ data: [] as { started_at: string | null; eu_reach: number | null }[] }),
    supabase.from("ad_term_hits").select("ad_watch_terms(term, country)").eq("ad_id", id),
    tab === "andere"
      ? similarAdsOfOthers(supabase, id, ad.advertiser_id)
      : ad.advertiser_id
        ? adsOfAdvertiser(supabase, ad.advertiser_id, id).then((c) => ({ cards: c, terms: null }))
        : Promise.resolve({ cards: [], terms: null }),
  ]);
  const shop = shopRes.data as { id: string; name: string } | null;
  const snapRes = shop
    ? await supabase.from("shop_snapshots").select("day, active_ads, capped").eq("shop_id", shop.id).order("day", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const snap = snapRes.data as { day: string; active_ads: number; capped: boolean } | null;
  const known = (knownRes.data ?? []) as { started_at: string | null; eu_reach: number | null }[];
  const reachSum = known.reduce((s, k) => s + (k.eu_reach ?? 0), 0);
  const reachCount = known.filter((k) => k.eu_reach !== null).length;
  const firstStart = known.map((k) => k.started_at).filter((x): x is string => Boolean(x)).sort()[0] ?? null;
  const terms = ((termsRes.data ?? []) as { ad_watch_terms: { term: string; country: string } | { term: string; country: string }[] | null }[])
    .flatMap((t) => (Array.isArray(t.ad_watch_terms) ? t.ad_watch_terms : t.ad_watch_terms ? [t.ad_watch_terms] : []));

  return (
    <>
      <PageHeader title="Anzeige analysieren" description="Alles, was TrendRadar über diese Anzeige und ihren Shop gemessen hat. Keine Schätzungen." />
      <Link href="/ad-spy/rangliste" className="-mt-5 mb-6 inline-block text-[13px] text-muted hover:text-foreground">
        ← Zurück zu den Anzeigen
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <Monogram name={ad.advertiser_name} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium">{ad.advertiser_name ?? "Unbekannte Seite"}</h2>
              <p className="text-[12px] text-muted tabular-nums">Anzeige {ad.external_id}</p>
            </div>
            <ProvenanceBadge kind="data" />
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <AdPreview adId={ad.id} canEmbed={canEmbed} libraryHref={libraryUrl(ad.external_id)} autoLoad className="aspect-[9/16] max-h-[640px] w-full">
              <AdCreativeText ad={ad} />
            </AdPreview>
            <div className="min-w-0 space-y-5">
              <AdCreativeText ad={ad} large />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Fact label="Status">
                  <span className={cn("inline-flex items-center gap-1.5", running ? "text-positive" : "text-muted")}>
                    <span className={cn("size-1.5 rounded-full", running ? "bg-positive" : "bg-subtle")} aria-hidden />
                    {running ? "läuft" : "beendet"}
                  </span>
                </Fact>
                <Fact label="Laufzeit">{days !== null ? `${days} Tage` : "unbekannt"}</Fact>
                <Fact label="Start">{fmtDate(ad.started_at)}</Fact>
                <Fact label="Ende">{running ? "–" : fmtDate(ad.stopped_at)}</Fact>
                <Fact label="EU-Reichweite">{ad.eu_reach !== null ? fmtNumber(ad.eu_reach) : "keine Angabe"}</Fact>
                <Fact label="Zuletzt aktiv gesehen">{lastSeen ? fmtDate(`${lastSeen}T12:00:00Z`) : "–"}</Fact>
                <Fact label="Plattformen">{(ad.publisher_platforms ?? []).map((p) => p.charAt(0) + p.slice(1).toLowerCase().replace("_", " ")).join(", ") || "–"}</Fact>
                <Fact label="Länder gesehen">{countries.join(", ") || "–"}</Fact>
              </dl>
              {terms.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="size-3.5 text-subtle" aria-hidden />
                  {terms.map((t) => (
                    <Badge key={`${t.term}-${t.country}`}>
                      {t.term} · {t.country}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {shopUrl ? (
                  <a href={shopUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
                    Shop besuchen: {ad.domain} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
                <a href={libraryUrl(ad.external_id)} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                  In der Ad Library <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
              <p className="text-[12px] leading-relaxed text-subtle">
                Meta liefert über die API weder Video- noch Bilddateien, keinen Button-Text und keine Ziel-URL. Die Vorschau ist die offizielle Seite von Meta, die Shop-Domain
                stammt aus der Link-Beschriftung der Anzeige.
              </p>
            </div>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Shop-Info" description="Facebook-Seite hinter der Anzeige." action={<Store className="size-4 text-subtle" aria-hidden />} />
          <dl className="divide-y divide-border text-sm">
            <Row label="Aktive Anzeigen (EU)">
              {snap ? (
                <span className="tabular-nums" title={`Zählung vom ${fmtDate(`${snap.day}T12:00:00Z`)}`}>
                  {snap.capped ? "mind. " : ""}
                  {snap.active_ads.toLocaleString("de-CH")}
                </span>
              ) : (
                <span className="text-subtle" title="Shop verfolgen, damit TrendRadar täglich alle aktiven Anzeigen zählt.">
                  nicht gezählt
                </span>
              )}
            </Row>
            <Row label="Davon TrendRadar bekannt">
              <span className="tabular-nums">{ad.stats ? `${ad.stats.active} laufend / ${ad.stats.total} gesamt` : "–"}</span>
            </Row>
            <Row label="EU-Reichweite (bekannte Anzeigen)">
              <span className="tabular-nums" title={`Summe über ${reachCount} Anzeigen mit Angabe. Personen können doppelt gezählt sein.`}>
                {reachCount ? fmtNumber(reachSum) : "–"}
              </span>
            </Row>
            <Row label="Älteste bekannte Anzeige">{fmtDate(firstStart)}</Row>
            <Row label="Ausgaben">
              <span className="text-subtle" title="Meta nennt Ausgaben nur für politische Anzeigen.">
                nicht verfügbar
              </span>
            </Row>
          </dl>
          <div className="flex flex-col gap-2 border-t border-border px-5 py-4">
            {shop ? (
              <Link href={`/shop-spy/${shop.id}`} className={buttonClass("secondary", "sm")}>
                Im Shop Spy öffnen
              </Link>
            ) : ad.page_id ? (
              <form action={trackShop}>
                <input type="hidden" name="seite" value={ad.page_id} />
                <input type="hidden" name="name" value={ad.advertiser_name ?? ""} />
                <SubmitButton variant="secondary" size="sm" className="w-full" pendingLabel="Wird gespeichert …">
                  Shop verfolgen
                </SubmitButton>
              </form>
            ) : null}
            {ad.page_id ? (
              <a href={libraryPageUrl(ad.page_id)} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")}>
                Alle Anzeigen in der Ad Library <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </Card>
      </div>

      <nav className="mt-10 mb-5 flex gap-5 overflow-x-auto border-b border-border text-sm [scrollbar-width:none]" aria-label="Weitere Anzeigen">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "shop" ? `/ad-spy/anzeige/${id}` : `/ad-spy/anzeige/${id}?ansicht=${t.value}`}
            aria-current={tab === t.value ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-2.5 transition-colors duration-150",
              tab === t.value ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {related.cards.length ? (
        <AdGrid>
          {related.cards.map((c) => (
            <AdCard key={c.id} ad={c} canEmbed={canEmbed} />
          ))}
        </AdGrid>
      ) : (
        <Card>
          <EmptyState icon={tab === "shop" ? CalendarDays : Megaphone} title={tab === "shop" ? "Keine weiteren Anzeigen dieses Shops bekannt" : "Keine ähnlichen Anzeigen bekannt"}>
            {tab === "shop"
              ? "TrendRadar kennt nur Anzeigen, die über Stichwörter, Live-Suchen oder die Shop-Zählung gefunden wurden."
              : related.terms === 0
                ? "Diese Anzeige wurde nicht über ein Stichwort gefunden. Ähnliche Anzeigen werden über gemeinsame Stichwörter aus dem Datensammler gesucht."
                : "Über die gleichen Stichwörter wurden noch keine Anzeigen anderer Shops gefunden."}
          </EmptyState>
        </Card>
      )}
      {tab === "andere" ? (
        <p className="mt-4 text-[12px] text-subtle">Ähnlich heisst: über dasselbe Stichwort gefunden. Es ist keine inhaltliche Bewertung.</p>
      ) : null}
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate tabular-nums">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2.5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
