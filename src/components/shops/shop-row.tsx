import Link from "next/link";
import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Monogram } from "@/components/ads/ad-card";
import { FavoriteShopButton } from "@/components/shops/favorite-shop-button";
import { domainUrl } from "@/lib/ads/feed";
import { sparklinePoints } from "@/lib/sparkline";
import { formatCount, type ShopTrend } from "@/lib/shops/shops";

export type ShopRowData = {
  id: string;
  name: string;
  favorite?: boolean;
  domain: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  trend: ShopTrend | null;
  newAds: number | null;
  /** Aktive Anzeigen pro Tag, älteste zuerst. */
  series: number[];
};

/** Shop als Zeile: Name und Domain, Verlauf der aktiven Anzeigen, Kennzahlen. */
export function ShopRow({ shop: s }: { shop: ShopRowData }) {
  const t = s.trend;
  const url = domainUrl(s.domain);
  const points = sparklinePoints(s.series, 120, 32, 2);
  return (
    <li className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <Monogram name={s.name} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <FavoriteShopButton id={s.id} favorite={Boolean(s.favorite)} />
            <Link href={`/shop-spy/${s.id}`} className="truncate text-sm font-medium transition-colors duration-150 hover:text-accent">
              {s.name}
            </Link>
            {t?.scaling ? (
              <Badge tone="accent" title="Mindestens verdoppelt und mindestens 5 Anzeigen mehr als vor 7 Tagen">
                <TrendingUp className="size-3" aria-hidden /> Signal: skaliert
              </Badge>
            ) : t?.dropping ? (
              <Badge tone="warning" title="Mindestens halbiert gegenüber vor 7 Tagen">
                <TrendingDown className="size-3" aria-hidden /> stark rückläufig
              </Badge>
            ) : null}
          </div>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-muted hover:text-foreground">
              {s.domain} <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <p className="mt-0.5 text-[12px] text-subtle">keine Domain erkannt</p>
          )}
          {s.last_error ? <p className="mt-1 text-[12px] text-warning">{s.last_error}</p> : null}
        </div>
      </div>

      <div title="Aktive Anzeigen pro Tag, letzte 60 Tage">
        {s.series.length > 1 ? (
          <svg viewBox="0 0 120 32" className="h-8 w-[120px]" role="img" aria-label={`Verlauf: ${s.series.join(", ")} aktive Anzeigen`}>
            <polyline points={points} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        ) : (
          <span className="text-[12px] text-subtle">noch kein Verlauf</span>
        )}
      </div>

      <div className="flex items-center gap-5">
        <Stat label="aktiv" value={t ? formatCount(t.latest.activeAds, t.latest.capped) : "–"} />
        <Stat
          label="vs. 7 Tage"
          value={t?.delta === null || t?.delta === undefined ? "–" : `${t.delta > 0 ? "+" : ""}${t.delta}`}
          tone={t?.delta ? (t.delta > 0 ? "text-positive" : "text-negative") : undefined}
        />
        <Stat label="neu 7 T" value={s.newAds !== null ? String(s.newAds) : "–"} />
        <Link href={`/shop-spy/${s.id}`} className={buttonClass("secondary", "sm", "hidden md:inline-flex")}>
          Öffnen
        </Link>
      </div>
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="w-16 text-right">
      <span className={`block text-sm tabular-nums ${tone ?? ""}`}>{value}</span>
      <span className="block text-[11px] text-muted">{label}</span>
    </span>
  );
}
