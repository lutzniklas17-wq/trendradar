import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { BrowseHeader } from "@/components/layout/browse-header";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOwner } from "@/lib/auth";
import { filterShops, hasShopFilters, parseShopFilters, resultLabel, SHOP_SIGNALS, SHOP_SORTS } from "@/lib/list-filters";
import { getMetaEnv } from "@/lib/env";
import { dayDaysAgo, shopTrend, sortedDomains, zurichDay, type Snapshot } from "@/lib/shops/shops";
import { ShopRow } from "@/components/shops/shop-row";
import { QuickChips } from "@/components/ui/quick-chips";
import { shopListHref } from "@/lib/shops/list-href";
import { refreshAllShops, trackShop } from "./actions";
import { inputClass } from "@/components/ui/field";

export const metadata: Metadata = { title: "Shop Spy" };
// Server Actions dieser Seite zählen mehrere Shops nacheinander.
export const maxDuration = 300;

type Row = {
  id: string;
  page_id: string;
  name: string;
  last_checked_at: string | null;
  last_error: string | null;
  favorite?: boolean;
  origin?: string;
  active?: boolean;
  discovered_reason?: string | null;
  created_at: string;
  shop_snapshots: { day: string; active_ads: number; capped: boolean; domains: Record<string, number> | null; new_ads: number | null; longest_days: number | null }[];
};

export default async function ShopSpyPage({ searchParams }: PageProps<"/shop-spy">) {
  const params = await searchParams;
  const filters = parseShopFilters(params);
  const errorMessage = typeof params.fehler === "string" ? params.fehler.slice(0, 300) : null;
  const { supabase } = await requireOwner();
  const configured = getMetaEnv() !== null;

  const since = dayDaysAgo(60);
  const { data, error } = await supabase
    .from("tracked_shops")
    .select("*, shop_snapshots(day, active_ads, capped, domains, new_ads, longest_days)") // * enthält favorite ab Migration 0006
    .gte("shop_snapshots.day", since)
    .order("name");
  const shops = ((data ?? []) as Row[]).map((s) => {
    const snaps: Snapshot[] = s.shop_snapshots.map((x) => ({ day: x.day, activeAds: x.active_ads, capped: x.capped }));
    const latestRow = [...s.shop_snapshots].sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
    const trend = shopTrend(snaps);
    return {
      ...s,
      trend,
      latestRow,
      domain: sortedDomains(latestRow?.domains ?? {})[0]?.domain ?? null,
      activeAds: trend?.latest.activeAds ?? null,
      delta: trend?.delta ?? null,
      newAds: latestRow?.new_ads ?? null,
      scaling: Boolean(trend?.scaling),
      dropping: Boolean(trend?.dropping),
      hasError: Boolean(s.last_error),
      paused: s.active === false,
      longestDays: latestRow?.longest_days ?? null,
      createdAt: s.created_at,
    };
  });
  const autoCount = shops.filter((s) => s.origin === "auto" && !s.paused).length;
  const visibleShops = filterShops(shops, filters);

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
  const dueCount = shops.filter((s) => !s.paused && (!s.last_checked_at || zurichDay(new Date(s.last_checked_at)) < today)).length;

  return (
    <>
      <BrowseHeader
        icon={Store}
        title="Shops"
        accent="entdecken"
        description="Shops, die das System selbst in den gesammelten Anzeigen findet, plus die Shops, die du verfolgst. Jeder wird täglich gezählt. Quelle: Meta Ad Library, nur EU."
      />

      {errorMessage ? <Notice>{errorMessage}</Notice> : null}
      {error ? <Notice>Shops konnten nicht geladen werden. Ist die Migration 0003_shops.sql in Supabase gelaufen?</Notice> : null}

      <Card className="mb-6">
        <form action={trackShop} className="flex flex-wrap items-end gap-3 p-5">
          <label className="flex min-w-72 flex-1 flex-col gap-1.5">
            <span className="text-[13px] text-muted">Shop verfolgen: Seiten-ID oder Ad-Library-Link</span>
            <input name="seite" required maxLength={500} className={inputClass} placeholder="https://www.facebook.com/ads/library/?view_all_page_id=…" />
          </label>
          <label className="flex min-w-48 flex-col gap-1.5">
            <span className="text-[13px] text-muted">Name (optional)</span>
            <input name="name" maxLength={200} className={inputClass} placeholder="wird von Meta übernommen" />
          </label>
          <SubmitButton
            disabled={!configured}
            pendingLabel="Wird gezählt…"
            title={configured ? undefined : "Erst möglich, wenn META_ACCESS_TOKEN gesetzt ist"}
          >
            Verfolgen
          </SubmitButton>
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
              title={`${shops.length - shops.filter((s) => s.paused).length} Shops, davon ${autoCount} automatisch entdeckt`}
              description="Aktive Anzeigen heute im Vergleich zum Stand vor mindestens 7 Tagen. Viele neue Anzeigen deuten auf Skalierung hin; das ist ein Signal, kein Beleg für Umsatz."
              action={
                dueCount && configured ? (
                  <form action={refreshAllShops}>
                    <SubmitButton variant="secondary" size="sm" pendingLabel="Zähle…">
                      {dueCount} jetzt zählen
                    </SubmitButton>
                  </form>
                ) : (
                  <ProvenanceBadge kind="data" />
                )
              }
            />
            <FilterBar
              path="/shop-spy"
              query={filters.text}
              queryPlaceholder="Shop oder Domain…"
              active={hasShopFilters(filters)}
              resultLabel={resultLabel(visibleShops.length, shops.length, ["Shop", "Shops"])}
              controls={[
                { kind: "select", name: "signal", label: "Signal", value: filters.signal, options: SHOP_SIGNALS },
                { kind: "select", name: "sortierung", label: "Sortierung", value: filters.sort, options: SHOP_SORTS },
              ]}
            />
            <QuickChips
              items={[
                { label: "Meiste aktive Anzeigen", href: shopListHref(filters, { signal: "", sort: "" }), active: !filters.signal && !filters.sort },
                { label: "Stärkster Anstieg", href: shopListHref(filters, { signal: "", sort: "veraenderung" }), active: !filters.signal && filters.sort === "veraenderung" },
                { label: "Längste Laufzeit", href: shopListHref(filters, { signal: "", sort: "laufzeit" }), active: !filters.signal && filters.sort === "laufzeit" },
                { label: "Neu entdeckt", href: shopListHref(filters, { signal: "auto", sort: "entdeckt" }), active: filters.signal === "auto" && filters.sort === "entdeckt" },
                { label: "Skaliert gerade", href: shopListHref(filters, { signal: "skaliert", sort: "veraenderung" }), active: filters.signal === "skaliert" },
                { label: "Meiste neue Anzeigen", href: shopListHref(filters, { signal: "", sort: "neu" }), active: !filters.signal && filters.sort === "neu" },
                { label: "Stark rückläufig", href: shopListHref(filters, { signal: "ruecklaeufig", sort: "" }), active: filters.signal === "ruecklaeufig" },
                { label: "Noch nicht gezählt", href: shopListHref(filters, { signal: "ungezaehlt", sort: "" }), active: filters.signal === "ungezaehlt" },
              ]}
            />
            {visibleShops.length ? (
              <ul className="divide-y divide-border">
                {visibleShops.map((s) => (
                  <ShopRow
                    key={s.id}
                    shop={{
                      id: s.id,
                      name: s.name,
                      favorite: s.favorite,
                      domain: s.domain,
                      last_checked_at: s.last_checked_at,
                      last_error: s.last_error,
                      trend: s.trend,
                      newAds: s.newAds,
                      series: [...s.shop_snapshots].sort((x, y) => x.day.localeCompare(y.day)).map((x) => x.active_ads),
                      origin: s.origin,
                      reason: s.discovered_reason,
                      longestDays: s.longestDays,
                    }}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={Store} title="Keine Shops für diese Filter">
                Filter lockern oder zurücksetzen.
              </EmptyState>
            )}
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
          <EmptyState icon={Store} title="Noch keine Shops">
            {configured
              ? "Das System nimmt jeden Morgen automatisch die aktivsten Shops aus den gesammelten Anzeigen auf. Die ersten erscheinen nach dem nächsten Anzeigen-Lauf. Du kannst oben auch selbst einen Shop hinzufügen."
              : "Shops werden automatisch aus den gesammelten Meta-Anzeigen entdeckt. Dafür fehlt noch der META_ACCESS_TOKEN (siehe Datensammler → Datenquellen)."}
          </EmptyState>
        </Card>
      ) : null}
    </>
  );
}
