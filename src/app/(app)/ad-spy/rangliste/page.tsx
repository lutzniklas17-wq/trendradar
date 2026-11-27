import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Megaphone, Trophy } from "lucide-react";
import { BrowseHeader } from "@/components/layout/browse-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { FilterPanel } from "@/components/ui/filter-panel";
import { QuickChips } from "@/components/ui/quick-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { AdSpyNav } from "@/components/ads/ad-spy-nav";
import { AdCard, AdGrid } from "@/components/ads/ad-card";
import { loadAdCards } from "@/lib/ads/feed";
import { getMetaEnv } from "@/lib/env";
import { requireOwner } from "@/lib/auth";
import { AD_COUNTRIES, libraryPageUrl, LONG_RUNNING_DAYS } from "@/lib/ads/meta";
import {
  AD_SORTS,
  ADVERTISER_SORTS,
  parseRankFilters,
  RANK_PLATFORMS,
  RANK_WINDOWS,
  rankAds,
  rankAdvertisers,
  rankHref,
} from "@/lib/ads/rankings";
import { trackShop } from "../../shop-spy/actions";

export const metadata: Metadata = { title: "Ad Spy Rangliste" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const platformLabel = (p: string) => p.charAt(0) + p.slice(1).toLowerCase().replace("_", " ");

export default async function RanglistePage({ searchParams }: PageProps<"/ad-spy/rangliste">) {
  const params = await searchParams;
  const f = parseRankFilters(params);
  const advertiserParam = typeof params.werbetreibender === "string" && UUID.test(params.werbetreibender) ? params.werbetreibender : null;
  const { supabase } = await requireOwner();

  const termsRes = await supabase.from("ad_watch_terms").select("id, term, country").order("term");
  const terms = (termsRes.data ?? []) as { id: string; term: string; country: string }[];
  const termLabel = terms.find((t) => t.id === f.termId);

  const view = advertiserParam ? "anzeigen" : f.view;
  const sorts = view === "anzeigen" ? AD_SORTS : ADVERTISER_SORTS;
  const sortValue = view === "anzeigen" && advertiserParam && f.view !== "anzeigen" ? "longest" : f.sort;
  const [advertisers, ads] = await Promise.all([
    view === "werbetreibende" ? rankAdvertisers(supabase, f) : Promise.resolve(null),
    view === "anzeigen" ? rankAds(supabase, { ...f, sort: sortValue, advertiserId: advertiserParam }) : Promise.resolve(null),
  ]);
  const error = advertisers?.error ?? ads?.error ?? null;
  const canEmbed = Boolean(getMetaEnv());
  const { cards: adCards } = ads
    ? await loadAdCards(supabase, ads.rows.map((r) => r.id), new Map(ads.rows.map((r) => [r.id, r.countries])))
    : { cards: [] };
  const advertiserName = advertiserParam ? (ads?.rows[0]?.advertiser_name ?? "Werbetreibender") : null;
  // Filter-Links behalten Ansicht, Sortierung und den gewählten Werbetreibenden.
  const panelHref = (change: Partial<typeof f>) => {
    const href = rankHref({ ...f, view, sort: sortValue }, change);
    return advertiserParam ? `${href}&werbetreibender=${advertiserParam}` : href;
  };
  const windowLabel = RANK_WINDOWS.find((w) => w.value === String(f.days))?.label ?? "";

  return (
    <>
      <BrowseHeader
        icon={Megaphone}
        title="Anzeigen"
        accent="durchsuchen"
        description="Aus deinen täglichen Sammelläufen und Live-Suchen. Meta liefert keine Rangliste, hier zählt, was TrendRadar gesehen hat."
      />
      <AdSpyNav active="rangliste" />

      <QuickChips
        className="px-0 pt-0"
        items={[
          { label: "Meiste aktive Anzeigen", href: rankHref(f, { view: "werbetreibende", sort: "active" }), active: view === "werbetreibende" && f.sort === "active" },
          { label: "Skaliert gerade", href: rankHref(f, { view: "werbetreibende", sort: "new" }), active: view === "werbetreibende" && f.sort === "new", title: "Meiste neue Anzeigen in 7 Tagen" },
          { label: "Längste Laufzeit", href: rankHref(f, { view: "anzeigen", sort: "longest" }), active: view === "anzeigen" && !advertiserParam && f.sort === "longest" },
          { label: "Neueste Anzeigen", href: rankHref(f, { view: "anzeigen", sort: "newest" }), active: view === "anzeigen" && !advertiserParam && f.sort === "newest" },
          { label: "Grösste EU-Reichweite", href: rankHref(f, { view: "anzeigen", sort: "reach" }), active: view === "anzeigen" && !advertiserParam && f.sort === "reach" },
        ]}
      />
      <div className="mb-6">
        <FilterPanel
          resetHref={panelHref({ days: 2, country: null, platform: null, termId: null })}
          active={Boolean(f.country || f.platform || f.termId || f.days !== 2)}
          groups={[
            {
              title: "Anzeige",
              items: [
                { kind: "choice", icon: "sort", label: "Sortierung", options: sorts.map((o) => ({ label: o.label, active: o.value === sortValue, href: panelHref({ sort: o.value }) })) },
                { kind: "choice", icon: "calendar", label: "Aktiv gesehen", options: RANK_WINDOWS.map((o) => ({ label: o.label, active: o.value === String(f.days), href: panelHref({ days: Number(o.value) }) })) },
              ],
            },
            {
              title: "Ort",
              items: [
                {
                  kind: "choice",
                  icon: "globe",
                  label: "Land",
                  options: [{ value: "", label: "Alle Länder" }, ...AD_COUNTRIES.map((c) => ({ value: c.code, label: c.label })), { value: "EU", label: "EU gesamt (Shop-Zählung)" }].map((o) => ({
                    label: o.label,
                    active: o.value === (f.country ?? ""),
                    href: panelHref({ country: o.value || null }),
                  })),
                },
              ],
            },
            {
              title: "Plattform",
              items: [{ kind: "choice", icon: "layers", label: "Plattform", options: RANK_PLATFORMS.map((o) => ({ label: o.label, active: o.value === (f.platform ?? ""), href: panelHref({ platform: o.value || null }) })) }],
            },
            {
              title: "Quelle",
              items: [
                {
                  kind: "choice",
                  icon: "tag",
                  label: "Stichwort",
                  options: [{ value: "", label: "Alle Stichwörter" }, ...terms.map((t) => ({ value: t.id, label: `${t.term} (${t.country})` }))].map((o) => ({
                    label: o.label,
                    active: o.value === (f.termId ?? ""),
                    href: panelHref({ termId: o.value || null }),
                  })),
                },
              ],
            },
          ]}
        />
      </div>

      {error ? (
        <Card className="mb-6 border-warning/40">
          <p className="px-5 py-3 text-sm text-warning">{error}</p>
        </Card>
      ) : null}

      {advertisers ? (
        <Card>
          <CardHeader
            title={`Werbetreibende · ${ADVERTISER_SORTS.find((s) => s.value === f.sort)?.label}`}
            description={`Aktiv gesehen: ${windowLabel}${f.country ? ` · ${f.country}` : ""}${f.platform ? ` · ${platformLabel(f.platform)}` : ""}${termLabel ? ` · Stichwort „${termLabel.term}“` : ""}. Viele aktive oder neue Anzeigen sind ein Signal für Tests oder Skalierung, kein Beleg für Umsatz.`}
            action={<ProvenanceBadge kind="data" />}
          />
          {advertisers.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="px-5 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Werbetreibender</th>
                    <th className="px-3 py-2 text-right font-medium">Aktiv</th>
                    <th className="px-3 py-2 text-right font-medium">Neu (7 T.)</th>
                    <th className="px-3 py-2 text-right font-medium">Längste</th>
                    <th className="px-3 py-2 font-medium">Länder · Plattformen</th>
                    <th className="px-5 py-2 font-medium">Weiter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {advertisers.rows.map((r, i) => (
                    <tr key={r.advertiser_id}>
                      <td className="px-5 py-3 tabular-nums text-muted">{i + 1}</td>
                      <td className="px-3 py-3">
                        <Link href={`/ad-spy/rangliste?${new URLSearchParams({ werbetreibender: r.advertiser_id, zeitraum: String(f.days) })}`} className="font-medium hover:text-accent">
                          {r.name}
                        </Link>
                        {r.longest_days !== null && r.longest_days >= LONG_RUNNING_DAYS ? (
                          <Badge tone="accent" className="ml-2">Signal: lange Laufzeit</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{r.active_ads}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted">{r.new_ads}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted">{r.longest_days !== null ? `${r.longest_days} T.` : "–"}</td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {(r.countries ?? []).join(", ")}
                        {r.platforms?.length ? ` · ${r.platforms.map(platformLabel).join(", ")}` : ""}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex flex-wrap items-center gap-3 text-xs">
                          {r.tracked_shop_id ? (
                            <Link href={`/shop-spy/${r.tracked_shop_id}`} className="font-medium text-accent hover:underline">
                              Im Shop Spy
                            </Link>
                          ) : (
                            <form action={trackShop}>
                              <input type="hidden" name="seite" value={r.page_id} />
                              <input type="hidden" name="name" value={r.name} />
                              <button type="submit" className="font-medium text-accent hover:underline">
                                Shop verfolgen
                              </button>
                            </form>
                          )}
                          <a href={libraryPageUrl(r.page_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                            Ad Library <ExternalLink className="size-3" />
                          </a>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData />
          )}
        </Card>
      ) : null}

      {ads ? (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">
                {advertiserName ? `Anzeigen von ${advertiserName}` : `Anzeigen · ${AD_SORTS.find((s) => s.value === sortValue)?.label ?? "Längste Laufzeit"}`}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {`Aktiv gesehen: ${windowLabel}${f.country ? ` · ${f.country}` : ""}${f.platform ? ` · ${platformLabel(f.platform)}` : ""}${termLabel ? ` · Stichwort „${termLabel.term}“` : ""}.`}
              </p>
            </div>
            {advertiserParam ? (
              <Link href={rankHref(f, { view: "werbetreibende", sort: "active" })} className="text-[13px] text-accent hover:underline">
                ← zur Rangliste
              </Link>
            ) : (
              <ProvenanceBadge kind="data" />
            )}
          </div>
          {adCards.length ? (
            <AdGrid>
              {adCards.map((ad) => (
                <AdCard key={ad.id} ad={ad} canEmbed={canEmbed} />
              ))}
            </AdGrid>
          ) : (
            <Card>
              <NoData />
            </Card>
          )}
        </section>
      ) : null}
    </>
  );
}

function NoData() {
  return (
    <EmptyState icon={Trophy} title="Noch keine gesammelten Daten für diese Filter">
      Die Rangliste füllt sich, sobald der tägliche Sammellauf Stichwörter abfragt (
      <Link href="/sammler" className="text-accent hover:underline">
        Datensammler
      </Link>
      ) oder du im Ad Spy mit Status „Aktiv“ suchst. Ohne Meta-Token bleibt sie leer; es werden keine Beispieldaten gezeigt.
    </EmptyState>
  );
}
