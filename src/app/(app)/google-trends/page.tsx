import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ExternalLink, LineChart, Search } from "lucide-react";
import { BrowseHeader } from "@/components/layout/browse-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { QuickChips } from "@/components/ui/quick-chips";
import { Sparkline } from "@/components/ui/sparkline";
import { inputClass, Select } from "@/components/ui/field";
import { TrendChart } from "@/components/trends/trend-chart";
import { insightIcons, KeywordStat, RegionList, RelatedList } from "@/components/trends/insights";
import { requireOwner } from "@/lib/auth";
import { getDataForSeoEnv } from "@/lib/env";
import {
  isTrendGeo,
  isTrendTimeRange,
  MAX_KEYWORDS,
  parseKeywordInput,
  TREND_GEOS,
  TREND_TIME_RANGES,
  validateKeywords,
  type TrendGeo,
  type TrendTimeRange,
} from "@/lib/trends/dataforseo";
import { seriesOf, trendVerdict } from "@/lib/trends/insights";
import { CACHE_HOURS, getRecentTrends, getTrend, getTrendInsights, type InsightsLookup, type RecentTrend, type TrendLookup } from "@/lib/trends/service";

export const metadata: Metadata = { title: "Google Trends" };

const geoOptions = TREND_GEOS.map((g) => ({ value: g.code, label: g.label }));
const rangeOptions = TREND_TIME_RANGES.map((t) => ({ value: t.value, label: t.label }));

function trendsHref(q: string, geo: string, zeit: string) {
  const p = new URLSearchParams({ q, geo, zeit });
  return `/google-trends?${p.toString()}`;
}

export default async function GoogleTrendsPage({ searchParams }: PageProps<"/google-trends">) {
  const params = await searchParams;
  const raw = typeof params.q === "string" ? params.q.slice(0, 600) : "";
  const geo: TrendGeo = isTrendGeo(params.geo) ? params.geo : "2756";
  const timeRange: TrendTimeRange = isTrendTimeRange(params.zeit) ? params.zeit : "past_12_months";
  const keywords = parseKeywordInput(raw);
  const inputError = raw.trim() ? validateKeywords(keywords) : null;
  const configured = getDataForSeoEnv() !== null;

  const { supabase } = await requireOwner();
  let lookup: TrendLookup | null = null;
  let insights: InsightsLookup | null = null;
  if (raw.trim() && !inputError) {
    lookup = await getTrend(supabase, { keywords, geo, timeRange });
    if (lookup.status === "ok" && lookup.result.points.length) {
      insights = await getTrendInsights(supabase, { keywords, geo, timeRange });
    }
  }
  const recent = lookup ? [] : await getRecentTrends(supabase);

  const geoLabel = TREND_GEOS.find((g) => g.code === geo)?.label ?? "";
  const rangeLabel = TREND_TIME_RANGES.find((t) => t.value === timeRange)?.label ?? "";
  const q = keywords.join(", ");

  return (
    <>
      <BrowseHeader icon={LineChart} title="Google" accent="Trends" description="Wonach die Leute gerade suchen, als Kurve, mit steigenden Begriffen und Regionen." />

      <Form action="/google-trends" className="mb-8" role="search">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Suchbegriffe</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={raw}
              required
              maxLength={600}
              className={`${inputClass} h-12 rounded-xl pl-11 text-[15px] shadow-xs`}
              placeholder={`Bis ${MAX_KEYWORDS} Begriffe mit Komma, z. B. „led maske, red light therapy“`}
            />
          </label>
          <Select name="geo" aria-label="Region" options={geoOptions} defaultValue={geo} className="h-12 w-auto rounded-xl text-[13px] shadow-xs" />
          <Select name="zeit" aria-label="Zeitraum" options={rangeOptions} defaultValue={timeRange} className="h-12 w-auto rounded-xl text-[13px] shadow-xs" />
          <SubmitButton pendingLabel="Wird abgefragt…" className="h-12 rounded-xl px-5">
            Abfragen
          </SubmitButton>
        </div>
        <p className="mt-2.5 px-1 text-[13px] text-muted">
          Werte sind relativ (100 = höchster Punkt im Zeitraum), kein absolutes Suchvolumen. Ergebnisse bleiben {CACHE_HOURS} Stunden gespeichert und kosten dann nichts
          mehr. Eine neue Suche kostet bei DataForSEO rund 2 Rappen (Kurve plus verwandte Begriffe).
        </p>
      </Form>

      {inputError ? (
        <Card>
          <EmptyState icon={LineChart} title="Eingabe prüfen">
            {inputError}
          </EmptyState>
        </Card>
      ) : !lookup ? (
        <>
          {!configured ? <NotConfigured /> : null}
          <RecentTrends items={recent} configured={configured} />
        </>
      ) : lookup.status === "not_configured" ? (
        <NotConfigured />
      ) : lookup.status === "limit_reached" ? (
        <Card>
          <EmptyState icon={LineChart} title="Tageslimit erreicht">
            Heute wurden bereits {lookup.limit} neue Abfragen gemacht. Das Limit schützt vor unerwarteten Kosten und lässt sich mit DATAFORSEO_DAILY_LIMIT ändern.
            Gespeicherte Abfragen bleiben abrufbar.
          </EmptyState>
        </Card>
      ) : lookup.status === "error" ? (
        <Card>
          <EmptyState icon={LineChart} title="Abfrage fehlgeschlagen">
            {lookup.message}
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {lookup.result.points.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lookup.result.keywords.map((k, i) => (
                <KeywordStat key={k} keyword={k} index={i} verdict={trendVerdict(lookup.result.points, i)} series={seriesOf(lookup.result.points, i)} />
              ))}
            </div>
          ) : null}

          <Card>
            <CardHeader
              title={`Suchinteresse · ${geoLabel} · ${rangeLabel}`}
              description={`Abgefragt am ${new Date(lookup.fetchedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}${lookup.fromCache ? " (gespeichert, ohne Kosten)" : ""}`}
              action={<ProvenanceBadge kind="data" />}
            />
            <QuickChips
              label="Zeitraum"
              className="border-b border-border"
              items={TREND_TIME_RANGES.map((t) => ({
                href: trendsHref(q, geo, t.value),
                label: t.label,
                active: t.value === timeRange,
                title: t.value === timeRange ? undefined : "Neue Abfrage, falls noch nicht gespeichert",
              }))}
            />
            {lookup.result.points.length ? (
              <div className="p-5">
                <TrendChart keywords={lookup.result.keywords} points={lookup.result.points} />
              </div>
            ) : (
              <EmptyState icon={LineChart} title="Keine Daten">
                Google Trends hat für diese Begriffe in dieser Region zu wenig Suchanfragen.
              </EmptyState>
            )}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-xs text-muted">
              <span>Quelle: Google Trends über DataForSEO. Die Einschätzung („steigt stark“ usw.) ist eine Rechnung aus der Kurve, keine Prognose.</span>
              {lookup.result.checkUrl ? (
                <a href={lookup.result.checkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Bei Google Trends prüfen <ExternalLink className="size-3" />
                </a>
              ) : null}
            </p>
          </Card>

          {insights ? <InsightsSection insights={insights} geo={geo} timeRange={timeRange} /> : null}
        </div>
      )}
    </>
  );
}

function InsightsSection({ insights, geo, timeRange }: { insights: InsightsLookup; geo: string; timeRange: string }) {
  if (insights.status === "not_configured") return null;
  if (insights.status !== "ok") {
    return (
      <Card>
        <EmptyState icon={LineChart} title="Verwandte Begriffe nicht verfügbar">
          {insights.status === "limit_reached" ? `Tageslimit von ${insights.limit} Abfragen erreicht.` : insights.message}
        </EmptyState>
      </Card>
    );
  }
  const d = insights.insights;
  const href = (label: string) => trendsHref(label, geo, timeRange);
  return (
    <section className="flex flex-col gap-4" aria-label={`Mehr zu ${d.keyword}`}>
      <h2 className="text-sm font-medium">
        Mehr zu „{d.keyword}“ <span className="font-normal text-muted">· Klick auf einen Begriff startet eine neue Abfrage</span>
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <RelatedList
          title="Steigende Suchanfragen"
          description="Am stärksten gewachsen im Zeitraum. „Durchbruch“ heisst laut Google mehr als +5000 %."
          entries={d.risingQueries}
          mode="rising"
          hrefFor={href}
          icon={insightIcons.rising}
        />
        <RelatedList
          title="Beliebte Suchanfragen"
          description="Werden zusammen mit dem Begriff am häufigsten gesucht (100 = häufigste)."
          entries={d.topQueries}
          mode="top"
          hrefFor={href}
          icon={insightIcons.top}
        />
        <RelatedList
          title="Steigende Themen"
          description="Themen, die Google dem Begriff zuordnet, mit dem grössten Zuwachs."
          entries={d.risingTopics}
          mode="rising"
          hrefFor={href}
          icon={insightIcons.trending}
        />
        <RegionList regions={d.regions} />
      </div>
    </section>
  );
}

function RecentTrends({ items, configured }: { items: RecentTrend[]; configured: boolean }) {
  if (!items.length) {
    return configured ? (
      <Card>
        <EmptyState icon={LineChart} title="Noch keine Abfrage">
          Gib oben einen Begriff ein. Du siehst dann die Kurve, eine Einschätzung wie „steigt stark“, steigende verwandte Suchanfragen und die Regionen.
        </EmptyState>
      </Card>
    ) : null;
  }
  return (
    <section aria-label="Zuletzt abgefragt">
      <h2 className="mb-3 text-sm font-medium">Zuletzt abgefragt</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((r) => {
          const verdict = trendVerdict(r.result.points ?? [], 0);
          const geoLabel = TREND_GEOS.find((g) => g.code === r.geo)?.label ?? r.geo;
          const rangeLabel = TREND_TIME_RANGES.find((t) => t.value === r.timeRange)?.label ?? r.timeRange;
          return (
            <Link
              key={`${r.keywords.join(",")}|${r.geo}|${r.timeRange}`}
              href={trendsHref(r.keywords.join(", "), r.geo, r.timeRange)}
              title={r.fresh ? "Gespeichert, öffnen kostet nichts" : "Älter als 24 Stunden: öffnen fragt neu ab"}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-4 shadow-xs transition-colors duration-150 hover:bg-surface-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{r.keywords.join(", ")}</span>
                {verdict ? <Badge tone={verdict.tone}>{verdict.label}</Badge> : null}
              </div>
              <Sparkline values={seriesOf(r.result.points ?? [], 0)} width={200} height={40} label={`Verlauf von ${r.keywords[0]}`} />
              <p className="text-[13px] text-muted">
                {geoLabel} · {rangeLabel} · {new Date(r.fetchedAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NotConfigured() {
  return (
    <Card className="mb-6">
      <EmptyState icon={LineChart} title="DataForSEO ist noch nicht verbunden">
        Es werden keine Beispieldaten angezeigt. Sobald DATAFORSEO_LOGIN und DATAFORSEO_PASSWORD in Vercel gesetzt sind, erscheinen hier echte Kurven (Anleitung im README,
        Abschnitt „Google Trends“).
      </EmptyState>
    </Card>
  );
}
