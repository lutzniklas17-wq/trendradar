import type { Metadata } from "next";
import Link from "next/link";
import { Store, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOwner } from "@/lib/auth";
import { getMetaEnv } from "@/lib/env";
import { dayDaysAgo, formatCount, shopTrend, sortedDomains, zurichDay, type Snapshot } from "@/lib/shops/shops";
import { refreshAllShops, trackShop } from "./actions";

export const metadata: Metadata = { title: "Shop Spy" };
// Server Actions dieser Seite zählen mehrere Shops nacheinander.
export const maxDuration = 300;

const fieldClass = "h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent";

type Row = {
  id: string;
  page_id: string;
  name: string;
  last_checked_at: string | null;
  last_error: string | null;
  shop_snapshots: { day: string; active_ads: number; capped: boolean; domains: Record<string, number> | null; new_ads: number | null }[];
};

export default async function ShopSpyPage({ searchParams }: PageProps<"/shop-spy">) {
  const params = await searchParams;
  const errorMessage = typeof params.fehler === "string" ? params.fehler.slice(0, 300) : null;
  const { supabase } = await requireOwner();
  const configured = getMetaEnv() !== null;

  const since = dayDaysAgo(60);
  const { data, error } = await supabase
    .from("tracked_shops")
    .select("id, page_id, name, last_checked_at, last_error, shop_snapshots(day, active_ads, capped, domains, new_ads)")
    .gte("shop_snapshots.day", since)
    .order("name");
  const shops = ((data ?? []) as Row[]).map((s) => {
    const snaps: Snapshot[] = s.shop_snapshots.map((x) => ({ day: x.day, activeAds: x.active_ads, capped: x.capped }));
    const latestRow = [...s.shop_snapshots].sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
    return { ...s, trend: shopTrend(snaps), latestRow };
  });
  shops.sort((a, b) => (b.trend?.latest.activeAds ?? -1) - (a.trend?.latest.activeAds ?? -1));

  // Nach Domain gruppiert: mehrere Facebook-Seiten können auf denselben Shop verlinken.
  const byDomain = new Map<string, { ads: number; shops: string[] }>();
  for (const s of shops) {
    for (const { domain, count } of sortedDomains(s.latestRow?.domains ?? {})) {
      const g = byDomain.get(domain) ?? { ads: 0, shops: [] };
      g.ads += count;
      g.shops.push(s.name);
      byDomain.set(domain, g);
    }
  }
  const domains = [...byDomain].sort((a, b) => b[1].ads - a[1].ads).slice(0, 15);
  const today = zurichDay();
  const dueCount = shops.filter((s) => !s.last_checked_at || zurichDay(new Date(s.last_checked_at)) < today).length;

  return (
    <>
      <PageHeader
        title="Shop Spy"
        description="Wie viele Anzeigen ein Shop gerade schaltet und wie sich das entwickelt. Quelle: Meta Ad Library API, nur Anzeigen, die in der EU laufen."
      />

      {errorMessage ? (
        <Card className="mb-6 border-warning/40">
          <p className="px-5 py-3 text-sm text-warning">{errorMessage}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="mb-6 border-warning/40">
          <p className="px-5 py-3 text-sm text-warning">Shops konnten nicht geladen werden. Ist die Migration 0003_shops.sql in Supabase gelaufen?</p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <form action={trackShop} className="flex flex-wrap items-end gap-3 p-5">
          <label className="flex min-w-72 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Shop verfolgen: Seiten-ID oder Ad-Library-Link</span>
            <input name="seite" required maxLength={500} className={fieldClass} placeholder="https://www.facebook.com/ads/library/?view_all_page_id=…" />
          </label>
          <label className="flex min-w-48 flex-col gap-1 text-sm">
            <span className="font-medium">Name (optional)</span>
            <input name="name" maxLength={200} className={fieldClass} placeholder="wird von Meta übernommen" />
          </label>
          <Button type="submit" disabled={!configured}>
            Verfolgen
          </Button>
        </form>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          Einfacher: im <Link href="/ad-spy" className="text-accent hover:underline">Ad Spy</Link> nach einem Produkt suchen und beim
          Werbetreibenden auf „Shop verfolgen“ klicken. Jeder Shop wird täglich automatisch gezählt (sofern der tägliche Lauf
          eingerichtet ist, siehe README „Shop Spy“).
          {configured ? null : " Die Meta-API ist noch nicht verbunden, deshalb kann noch nichts gezählt werden."}
        </p>
      </Card>

      {shops.length ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`${shops.length} verfolgte Shops`}
              description="Aktive Anzeigen heute im Vergleich zum Stand vor mindestens 7 Tagen. Viele neue Anzeigen deuten auf Skalierung hin; das ist ein Signal, kein Beleg für Umsatz."
              action={
                dueCount && configured ? (
                  <form action={refreshAllShops}>
                    <Button type="submit" variant="secondary">
                      {dueCount} jetzt zählen
                    </Button>
                  </form>
                ) : (
                  <ProvenanceBadge kind="data" />
                )
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="px-5 py-2 font-medium">Shop</th>
                    <th className="px-3 py-2 text-right font-medium">Aktive Anzeigen</th>
                    <th className="px-3 py-2 text-right font-medium">vs. 7 Tage</th>
                    <th className="px-3 py-2 text-right font-medium">Neu (7 Tage)</th>
                    <th className="px-3 py-2 font-medium">Hauptdomain</th>
                    <th className="px-5 py-2 font-medium">Gezählt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shops.map((s) => {
                    const t = s.trend;
                    const main = sortedDomains(s.latestRow?.domains ?? {})[0]?.domain;
                    return (
                      <tr key={s.id}>
                        <td className="px-5 py-3">
                          <Link href={`/shop-spy/${s.id}`} className="font-medium hover:text-accent">
                            {s.name}
                          </Link>
                          {t?.scaling ? (
                            <Badge tone="accent" className="ml-2" title="Mindestens verdoppelt und mindestens 5 Anzeigen mehr als vor 7 Tagen">
                              <TrendingUp className="size-3" /> Signal: skaliert
                            </Badge>
                          ) : t?.dropping ? (
                            <Badge tone="warning" className="ml-2" title="Mindestens halbiert gegenüber vor 7 Tagen">
                              <TrendingDown className="size-3" /> stark rückläufig
                            </Badge>
                          ) : null}
                          {s.last_error ? <p className="mt-1 text-xs text-warning">{s.last_error}</p> : null}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{t ? formatCount(t.latest.activeAds, t.latest.capped) : "–"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">
                          {t?.delta === null || t?.delta === undefined ? "noch kein Vergleich" : `${t.delta > 0 ? "+" : ""}${t.delta}`}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted">{s.latestRow?.new_ads ?? "–"}</td>
                        <td className="px-3 py-3 text-muted">{main ?? "–"}</td>
                        <td className="px-5 py-3 text-xs text-muted">
                          {s.last_checked_at ? new Date(s.last_checked_at).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" }) : "noch nie"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {domains.length ? (
            <Card>
              <CardHeader
                title="Nach Domain gruppiert"
                description="Aktive Anzeigen je Shop-Domain, über alle verfolgten Seiten. Die Domain stammt aus der Link-Beschriftung der Anzeige; eine echte Landingpage-URL liefert Meta nicht."
              />
              <ul className="divide-y divide-border">
                {domains.map(([domain, g]) => (
                  <li key={domain} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">
                      {domain}
                    </a>
                    <span className="text-muted">
                      {g.ads} Anzeigen · {g.shops.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : !error ? (
        <Card>
          <EmptyState icon={Store} title="Noch keine Shops verfolgt">
            Füge oben einen Shop hinzu oder klicke im Ad Spy beim Werbetreibenden auf „Shop verfolgen“. Ab dann entsteht jeden Tag ein
            Messpunkt; einen Verlauf siehst du nach ein paar Tagen.
          </EmptyState>
        </Card>
      ) : null}
    </>
  );
}
