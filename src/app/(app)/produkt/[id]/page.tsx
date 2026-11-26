import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { MarketSection } from "@/components/product/market-section";
import { loadProductAds } from "@/lib/links";
import { ProfitCalculator, type ProvenanceMap, type ScenarioState } from "@/components/profit/profit-calculator";
import { SupplierSection } from "@/components/product/supplier-section";
import { SalesChannels } from "@/components/product/sales-channels";
import { AnalysisSection } from "@/components/product/analysis-section";
import { RatingSection } from "@/components/product/rating-section";
import { saveCalculation, toggleWatchlist } from "@/app/(app)/produkt/actions";
import { requireOwner } from "@/lib/auth";
import { averageScore, parseClaims, parseScores, parseVerdict, VERDICTS, type Assessment } from "@/lib/assessment";
import { bestSupplierOffer, fromRow, inputsFromOffer, OFFER_COLUMNS, type OfferRow } from "@/lib/offers";
import { getSupplierPlatform } from "@/lib/platforms";
import { EMPTY_INPUTS, type ProfitInputs } from "@/lib/profit";
import { formatDate, formatNumber, hostOf } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ItemRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  country: string | null;
  description: string | null;
  source_url: string | null;
  first_discovered_at: string;
  last_seen_at: string;
  sources: { name: string } | null;
};

type SignalRow = {
  metric: string;
  value: number | string;
  unit: string | null;
  observed_at: string;
  source_url: string | null;
  sources: { name: string } | null;
};

async function loadItem(id: string) {
  if (!UUID.test(id)) return null;
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("items")
    .select("id, name, type, category, country, description, source_url, first_discovered_at, last_seen_at, sources(name)")
    .eq("id", id)
    .maybeSingle();
  return data ? { supabase, item: data as unknown as ItemRow } : null;
}

export async function generateMetadata({ params }: PageProps<"/produkt/[id]">): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadItem(id);
  return { title: loaded?.item.name ?? "Produkt" };
}

export default async function ProductPage({ params }: PageProps<"/produkt/[id]">) {
  const { id } = await params;
  const loaded = await loadItem(id);
  if (!loaded) notFound();
  const { supabase, item } = loaded;

  const [offersRes, watchRes, assessmentRes, calcRes, signalsRes, market, trendRes] = await Promise.all([
    supabase.from("product_offers").select(OFFER_COLUMNS).eq("item_id", id).order("fetched_at", { ascending: false }),
    supabase.from("watchlist").select("item_id").eq("item_id", id).maybeSingle(),
    supabase
      .from("assessments")
      .select("id, model, summary, scores, claims, verdict, created_at")
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profit_scenarios").select("inputs, scenarios, currency").eq("item_id", id).maybeSingle(),
    supabase
      .from("signals")
      .select("metric, value, unit, observed_at, source_url, sources(name)")
      .eq("item_id", id)
      .order("observed_at", { ascending: false })
      .limit(100),
    loadProductAds(supabase, item),
    supabase
      .from("trend_series")
      .select("fetched_at")
      .contains("keywords", [item.name])
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const offers = ((offersRes.data ?? []) as OfferRow[]).map(fromRow);
  const watching = !!watchRes.data;

  let assessment: Assessment | null = null;
  if (assessmentRes.data) {
    const a = assessmentRes.data;
    const { verdict, reason } = parseVerdict(a.verdict);
    assessment = {
      id: a.id,
      model: a.model,
      createdAt: a.created_at,
      summary: a.summary,
      claims: parseClaims(a.claims),
      scores: parseScores(a.scores),
      verdict,
      verdictReason: reason,
    };
  }

  // Neueste Messung je Kennzahl
  const latestSignals = new Map<string, SignalRow>();
  for (const s of (signalsRes.data ?? []) as unknown as SignalRow[]) {
    if (!latestSignals.has(s.metric)) latestSignals.set(s.metric, s);
  }

  // Rechner: gespeicherte Werte haben Vorrang, sonst das günstigste bestätigte Lieferantenangebot.
  const saved = calcRes.data as { inputs: Partial<ProfitInputs>; scenarios: ScenarioState; currency: string } | null;
  const currency = saved?.currency ?? "CHF";
  const savedInputs: ProfitInputs = { ...EMPTY_INPUTS, ...(saved?.inputs ?? {}) };
  const best = bestSupplierOffer(offers, currency);
  const calcInputs = inputsFromOffer(savedInputs, best);
  const provenance: ProvenanceMap = {};
  if (best) {
    const kind = best.dataOrigin === "api" ? "data" : "manual";
    if (savedInputs.purchasePrice == null && best.price != null) provenance.purchasePrice = kind;
    if (savedInputs.shippingCost == null && best.shippingCost != null) provenance.shippingCost = kind;
  }
  const otherCurrencyOffers = offers.filter(
    (o) => o.role === "supplier" && o.matchStatus === "confirmed" && o.price != null && o.currency !== currency,
  ).length;

  const supplierOffers = offers.filter((o) => o.role === "supplier" && o.matchStatus !== "rejected");
  const referenceOffers = offers.filter((o) => o.role === "price_reference" && o.matchStatus !== "rejected" && o.price != null);
  const { average } = assessment ? averageScore(assessment.scores) : { average: null };

  const overview = (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Kurzüberblick" />
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Günstigstes bestätigtes Angebot ({currency})</dt>
            <dd className="mt-0.5 font-semibold">
              {best ? (
                <>
                  {formatNumber(best.price!)} {currency}
                  {best.shippingCost != null ? ` + ${formatNumber(best.shippingCost)} Versand` : ""}
                  <span className="ml-2 text-xs font-normal text-muted">{getSupplierPlatform(best.platform)?.name}</span>
                </>
              ) : (
                <span className="font-normal text-muted">Noch kein bestätigtes Angebot in {currency}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Preisreferenz Endkunde</dt>
            <dd className="mt-0.5 font-semibold">
              {referenceOffers.length ? (
                referenceOffers.map((o) => (
                  <span key={o.id} className="mr-3">
                    {formatNumber(o.price!)} {o.currency}
                  </span>
                ))
              ) : (
                <span className="font-normal text-muted">Nicht erfasst</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Bewertung</dt>
            <dd className="mt-0.5 font-semibold">
              {average != null ? `${formatNumber(average, 1)} / 5` : <span className="font-normal text-muted">Noch keine</span>}
              {assessment?.verdict ? (
                <Badge tone={VERDICTS[assessment.verdict].tone} className="ml-2">
                  {VERDICTS[assessment.verdict].label}
                </Badge>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Lieferantenangebote</dt>
            <dd className="mt-0.5 font-semibold">{supplierOffers.length}</dd>
          </div>
        </dl>
        {item.description ? <p className="border-t border-border px-5 py-4 text-sm">{item.description}</p> : null}
      </Card>
      <Card className="h-fit">
        <CardHeader
          title="Messwerte"
          description="Neuester Wert je Kennzahl, mit Quelle."
          action={
            <span className="flex shrink-0 gap-3">
              <Link href={`/google-trends?q=${encodeURIComponent(item.name)}`} prefetch={false} className="text-sm text-accent hover:underline">
                Google Trends
              </Link>
              <Link href={`/ad-spy?q=${encodeURIComponent(item.name.slice(0, 100))}`} prefetch={false} className="text-sm text-accent hover:underline">
                Ad Spy
              </Link>
            </span>
          }
        />
        {latestSignals.size ? (
          <ul className="divide-y divide-border text-sm">
            {[...latestSignals.values()].map((s) => (
              <li key={s.metric} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium">{s.metric}</p>
                  <p className="text-xs text-muted">
                    {s.sources?.name ?? "Quelle"} · {formatDate(s.observed_at)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold tabular-nums">
                    {formatNumber(Number(s.value), Number.isInteger(Number(s.value)) ? 0 : 2)}
                    {s.unit ? ` ${s.unit}` : ""}
                  </span>
                  <div>
                    <ProvenanceBadge kind="data" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted">
            Noch keine Messwerte. Suchinteresse und Anzeigen kommen mit Google Trends und der Meta Ad Library dazu.
          </p>
        )}
      </Card>
    </div>
  );

  const calculator = (
    <ProfitCalculator
      initialInputs={calcInputs}
      initialScenarios={saved?.scenarios ?? undefined}
      provenance={provenance}
      currency={currency}
      onSave={saveCalculation.bind(null, id)}
      sourceNote={
        best && (provenance.purchasePrice || provenance.shippingCost) ? (
          <>
            Einkauf und Versand vom günstigsten bestätigten Angebot ({getSupplierPlatform(best.platform)?.name}).
          </>
        ) : otherCurrencyOffers ? (
          <>
            {otherCurrencyOffers} bestätigte Angebote sind in einer anderen Währung. Es wird nicht automatisch
            umgerechnet.
          </>
        ) : null
      }
    />
  );

  return (
    <>
      <PageHeader title={item.name}>
        <form action={toggleWatchlist}>
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="watching" value={watching ? "1" : "0"} />
          <Button type="submit" variant={watching ? "secondary" : "primary"}>
            {watching ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
            {watching ? "Auf der Watchlist" : "Zur Watchlist"}
          </Button>
        </form>
      </PageHeader>
      <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        {item.category ? <Badge tone="accent">{item.category}</Badge> : null}
        {item.country ? <Badge>{item.country}</Badge> : null}
        <span>Entdeckt am {formatDate(item.first_discovered_at)}</span>
        <span>·</span>
        <span>Zuletzt gesehen {formatDate(item.last_seen_at)}</span>
        <span>·</span>
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-accent">
            Quelle: {hostOf(item.source_url)} <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          <span>Quelle: {item.sources?.name ?? "unbekannt"}</span>
        )}
      </div>

      <Tabs
        items={[
          { id: "uebersicht", label: "Übersicht", content: overview },
          {
            id: "lieferanten",
            label: "Lieferanten",
            count: supplierOffers.length,
            content: <SupplierSection itemId={item.id} query={item.name} offers={offers} />,
          },
          {
            id: "markt",
            label: "Anzeigen & Trends",
            count: market.advertisers.length || undefined,
            content: (
              <MarketSection
                item={item}
                terms={market.terms}
                ads={market.ads}
                advertisers={market.advertisers}
                trendFetchedAt={(trendRes.data?.fetched_at as string | undefined) ?? null}
              />
            ),
          },
          { id: "verkaufskanaele", label: "Verkaufskanäle", content: <SalesChannels query={item.name} /> },
          { id: "rechner", label: "Profit-Rechner", content: calculator },
          { id: "analyse", label: "Analyse", content: <AnalysisSection assessment={assessment} /> },
          { id: "bewertung", label: "Bewertung", content: <RatingSection assessment={assessment} /> },
        ]}
      />
    </>
  );
}
