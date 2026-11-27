import Link from "next/link";
import { ArrowUpRight, MapPin, Search, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import type { RegionEntry, RelatedEntry, TrendVerdict } from "@/lib/trends/insights";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export const chartColor = (i: number) => COLORS[i % COLORS.length];

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
};

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("de-CH")} %`;

/** Kennzahl-Kachel je Suchbegriff: Einschätzung, aktueller Wert, Veränderung, Höchststand, Mini-Verlauf. */
export function KeywordStat({ keyword, index, verdict, series }: { keyword: string; index: number; verdict: TrendVerdict | null; series: number[] }) {
  return (
    <Card className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="size-2 shrink-0 rounded-full" style={{ background: chartColor(index) }} aria-hidden />
          <span className="truncate">{keyword}</span>
        </span>
        {verdict ? (
          <Badge tone={verdict.tone} title="Regelbasierte Einschätzung: letztes Viertel der Kurve gegenüber dem ersten Viertel">
            {verdict.label}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{verdict ? verdict.current : "–"}</p>
          <p className="text-[13px] text-muted">aktuell, von 100</p>
        </div>
        <Sparkline values={series} width={112} height={36} color={chartColor(index)} label={`Verlauf von ${keyword}`} />
      </div>
      {verdict ? (
        <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[13px]">
          <div>
            <dt className="text-muted">Veränderung</dt>
            <dd className="font-medium tabular-nums">
              {verdict.changePct === null ? `0 → ${verdict.last}` : fmtPct(verdict.changePct)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Höchststand</dt>
            <dd className="font-medium tabular-nums">{fmtDate(verdict.peakDate)}</dd>
          </div>
        </dl>
      ) : (
        <p className="border-t border-border pt-3 text-[13px] text-muted">Zu wenige Messpunkte für eine Einschätzung.</p>
      )}
    </Card>
  );
}

/** Liste verwandter Suchanfragen oder Themen. Jede Zeile öffnet eine neue Trends-Abfrage für diesen Begriff. */
export function RelatedList({
  title,
  description,
  entries,
  mode,
  hrefFor,
  icon: Icon,
}: {
  title: string;
  description: string;
  entries: RelatedEntry[];
  mode: "top" | "rising";
  hrefFor: (label: string) => string;
  icon: typeof TrendingUp;
}) {
  const max = Math.max(1, ...entries.map((e) => e.value ?? 0));
  return (
    <Card>
      <CardHeader title={title} description={description} action={<Icon className="size-4 text-muted" aria-hidden />} />
      {entries.length ? (
        <ol className="divide-y divide-border">
          {entries.slice(0, 10).map((e, i) => (
            <li key={`${e.label}-${i}`}>
              <Link
                href={hrefFor(e.label)}
                className="group flex items-center gap-3 px-5 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-muted"
              >
                <span className="w-5 shrink-0 text-[13px] text-subtle tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.label}</span>
                  {e.kind ? <span className="block text-[12px] text-muted">{e.kind}</span> : null}
                </span>
                {mode === "rising" ? (
                  <Badge tone="positive">{e.value === null ? "Durchbruch" : fmtPct(e.value)}</Badge>
                ) : (
                  <span className="flex w-28 shrink-0 items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded bg-border">
                      <span className="block h-full rounded" style={{ width: `${((e.value ?? 0) / max) * 100}%`, background: "var(--chart-1)" }} />
                    </span>
                    <span className="w-7 text-right text-[13px] text-muted tabular-nums">{e.value ?? "–"}</span>
                  </span>
                )}
                <ArrowUpRight className="size-3.5 shrink-0 text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-4 text-[13px] text-muted">Google Trends liefert hier keine Einträge (zu wenige Suchanfragen).</p>
      )}
    </Card>
  );
}

export function RegionList({ regions }: { regions: RegionEntry[] }) {
  return (
    <Card>
      <CardHeader
        title="Regionen"
        description="Wo der Begriff im Verhältnis am meisten gesucht wird (100 = stärkste Region)"
        action={<MapPin className="size-4 text-muted" aria-hidden />}
      />
      {regions.length ? (
        <ol className="grid gap-x-8 gap-y-2.5 px-5 py-4 sm:grid-cols-2">
          {regions.slice(0, 12).map((r) => (
            <li key={r.geoId} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate">{r.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded bg-border">
                <span className="block h-full rounded" style={{ width: `${Math.min(100, r.value)}%`, background: "var(--chart-1)" }} />
              </span>
              <span className="w-7 text-right text-[13px] text-muted tabular-nums">{r.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-4 text-[13px] text-muted">Keine Regionsdaten für diese Abfrage.</p>
      )}
    </Card>
  );
}

export const insightIcons = { rising: Sparkles, top: Search, trending: TrendingUp };
