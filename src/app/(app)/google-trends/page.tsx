import type { Metadata } from "next";
import Form from "next/form";
import { ExternalLink, LineChart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendChart } from "@/components/trends/trend-chart";
import { requireOwner } from "@/lib/auth";
import { getDataForSeoEnv } from "@/lib/env";
import {
  isTrendGeo,
  isTrendTimeRange,
  MAX_KEYWORDS,
  parseKeywordInput,
  TREND_GEOS,
  TREND_TIME_RANGES,
  trendDirection,
  validateKeywords,
  type TrendGeo,
  type TrendTimeRange,
} from "@/lib/trends/dataforseo";
import { CACHE_HOURS, getTrend, type TrendLookup } from "@/lib/trends/service";
import { inputClass } from "@/components/ui/field";

export const metadata: Metadata = { title: "Google Trends" };

export default async function GoogleTrendsPage({ searchParams }: PageProps<"/google-trends">) {
  const params = await searchParams;
  const raw = typeof params.q === "string" ? params.q.slice(0, 600) : "";
  const geo: TrendGeo = isTrendGeo(params.geo) ? params.geo : "2756";
  const timeRange: TrendTimeRange = isTrendTimeRange(params.zeit) ? params.zeit : "past_12_months";
  const keywords = parseKeywordInput(raw);
  const inputError = raw.trim() ? validateKeywords(keywords) : null;
  const configured = getDataForSeoEnv() !== null;

  let lookup: TrendLookup | null = null;
  if (raw.trim() && !inputError) {
    const { supabase } = await requireOwner();
    lookup = await getTrend(supabase, { keywords, geo, timeRange });
  }

  const geoLabel = TREND_GEOS.find((g) => g.code === geo)?.label ?? "";
  const rangeLabel = TREND_TIME_RANGES.find((t) => t.value === timeRange)?.label ?? "";

  return (
    <>
      <PageHeader
        title="Google Trends"
        description="Relatives Suchinteresse (0–100) über DataForSEO. 100 ist der höchste Punkt im gewählten Zeitraum, kein absolutes Suchvolumen."
      />

      <Card className="mb-6">
        <Form action="/google-trends" className="flex flex-wrap items-end gap-3 p-5">
          <label className="flex min-w-64 flex-1 flex-col gap-1.5">
            <span className="text-[13px] text-muted">Suchbegriffe (bis {MAX_KEYWORDS}, mit Komma getrennt)</span>
            <input name="q" defaultValue={raw} required maxLength={600} className={inputClass} placeholder="z. B. led maske, red light therapy" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Region</span>
            <select name="geo" defaultValue={geo} className={inputClass}>
              {TREND_GEOS.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Zeitraum</span>
            <select name="zeit" defaultValue={timeRange} className={inputClass}>
              {TREND_TIME_RANGES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton pendingLabel="Wird abgefragt…">Abfragen</SubmitButton>
        </Form>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Ergebnisse werden {CACHE_HOURS} Stunden gespeichert; dieselbe Abfrage kostet in dieser Zeit nichts mehr.
          {configured ? null : " DataForSEO ist noch nicht verbunden (siehe unten)."}
        </p>
      </Card>

      {inputError ? (
        <Card>
          <EmptyState icon={LineChart} title="Eingabe prüfen">
            {inputError}
          </EmptyState>
        </Card>
      ) : !lookup ? (
        configured ? (
          <Card>
            <EmptyState icon={LineChart} title="Noch keine Abfrage">
              Gib bis zu {MAX_KEYWORDS} Begriffe ein, um ihr Suchinteresse zu vergleichen. Jede neue Abfrage kostet bei DataForSEO
              rund einen Rappen.
            </EmptyState>
          </Card>
        ) : (
          <NotConfigured />
        )
      ) : lookup.status === "not_configured" ? (
        <NotConfigured />
      ) : lookup.status === "limit_reached" ? (
        <Card>
          <EmptyState icon={LineChart} title="Tageslimit erreicht">
            Heute wurden bereits {lookup.limit} neue Abfragen gemacht. Das Limit schützt vor unerwarteten Kosten und lässt sich mit
            DATAFORSEO_DAILY_LIMIT ändern. Gespeicherte Abfragen bleiben abrufbar.
          </EmptyState>
        </Card>
      ) : lookup.status === "error" ? (
        <Card>
          <EmptyState icon={LineChart} title="Abfrage fehlgeschlagen">
            {lookup.message}
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`Suchinteresse · ${geoLabel} · ${rangeLabel}`}
            description={`Abgefragt am ${new Date(lookup.fetchedAt).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}${
              lookup.fromCache ? " (aus dem Zwischenspeicher)" : ""
            }`}
            action={<ProvenanceBadge kind="data" />}
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
          <ul className="divide-y divide-border border-t border-border">
            {lookup.result.keywords.map((k, i) => {
              const dir = trendDirection(lookup.result.points, i);
              const avg = lookup.result.averages[i];
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium">{k}</span>
                  <span className="flex flex-wrap items-center gap-3 text-muted">
                    {avg !== null && avg !== undefined ? <span>Durchschnitt {avg}</span> : null}
                    {dir ? (
                      <span title="Mittel des ersten Viertels gegenüber dem letzten Viertel der Messpunkte">
                        Anfang {dir.first} → Ende {dir.last}
                      </span>
                    ) : null}
                    {dir ? (
                      <Badge tone={dir.last > dir.first ? "positive" : dir.last < dir.first ? "negative" : "neutral"}>
                        {dir.last > dir.first ? "steigend" : dir.last < dir.first ? "fallend" : "gleich"}
                      </Badge>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-xs text-muted">
            <span>Quelle: Google Trends über DataForSEO. Werte sind relativ zueinander und zum Höchstwert im Zeitraum.</span>
            {lookup.result.checkUrl ? (
              <a href={lookup.result.checkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                Bei Google Trends prüfen <ExternalLink className="size-3" />
              </a>
            ) : null}
          </p>
        </Card>
      )}
    </>
  );
}

function NotConfigured() {
  return (
    <Card>
      <EmptyState icon={LineChart} title="DataForSEO ist noch nicht verbunden">
        Es werden keine Beispieldaten angezeigt. Sobald DATAFORSEO_LOGIN und DATAFORSEO_PASSWORD in Vercel gesetzt sind, erscheinen
        hier echte Kurven (Anleitung im README, Abschnitt „Google Trends“).
      </EmptyState>
    </Card>
  );
}
