import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { AdSpyNav } from "@/components/ads/ad-spy-nav";
import { requireOwner } from "@/lib/auth";
import { AD_COUNTRIES, libraryPageUrl, libraryUrl, LONG_RUNNING_DAYS } from "@/lib/ads/meta";
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
import { cn } from "@/lib/utils";
import { trackShop } from "../../shop-spy/actions";

export const metadata: Metadata = { title: "Ad Spy Rangliste" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }) : "unbekannt");
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
  const advertiserName = advertiserParam ? (ads?.rows[0]?.advertiser_name ?? "Werbetreibender") : null;
  const windowLabel = RANK_WINDOWS.find((w) => w.value === String(f.days))?.label ?? "";

  return (
    <>
      <PageHeader
        title="Ad Spy"
        description="Rangliste aus den selbst gesammelten Daten: täglicher Sammellauf über deine Stichwörter plus jede Live-Suche mit Status „Aktiv“. Meta selbst liefert keine globale Rangliste; hier zählt nur, was TrendRadar gesehen hat."
      />
      <AdSpyNav active="rangliste" />

      <Card className="mb-6">
        <FilterBar
          path="/ad-spy/rangliste"
          query={null}
          keep={{ ansicht: view, ...(advertiserParam ? { werbetreibender: advertiserParam } : {}) }}
          active={Boolean(f.country || f.platform || f.termId || f.days !== 2)}
          controls={[
            { kind: "select", name: "sortierung", label: "Sortierung", value: sortValue, options: sorts },
            { kind: "select", name: "zeitraum", label: "Aktiv gesehen", value: String(f.days), options: RANK_WINDOWS },
            { kind: "select", name: "land", label: "Land", value: f.country ?? "", options: [{ value: "", label: "Alle Länder" }, ...AD_COUNTRIES.map((c) => ({ value: c.code, label: c.label })), { value: "EU", label: "EU gesamt (Shop-Zählung)" }] },
            { kind: "select", name: "plattform", label: "Plattform", value: f.platform ?? "", options: RANK_PLATFORMS },
            { kind: "select", name: "stichwort", label: "Stichwort", value: f.termId ?? "", options: [{ value: "", label: "Alle Stichwörter" }, ...terms.map((t) => ({ value: t.id, label: `${t.term} (${t.country})` }))] },
          ]}
        />
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3 text-xs">
          <span className="self-center text-muted">Schnellwahl:</span>
          <QuickLink href={rankHref(f, { view: "werbetreibende", sort: "active" })} active={view === "werbetreibende" && f.sort === "active"}>
            Meiste aktive Anzeigen jetzt
          </QuickLink>
          <QuickLink href={rankHref(f, { view: "werbetreibende", sort: "new" })} active={view === "werbetreibende" && f.sort === "new"}>
            Skaliert gerade (neue Anzeigen)
          </QuickLink>
          <QuickLink href={rankHref(f, { view: "anzeigen", sort: "longest" })} active={view === "anzeigen" && !advertiserParam && f.sort === "longest"}>
            Längste Laufzeit
          </QuickLink>
          <QuickLink href={rankHref(f, { view: "anzeigen", sort: "newest" })} active={view === "anzeigen" && !advertiserParam && f.sort === "newest"}>
            Neueste Anzeigen
          </QuickLink>
        </div>
      </Card>

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
        <Card>
          <CardHeader
            title={advertiserName ? `Aktive Anzeigen von ${advertiserName}` : `Anzeigen · ${AD_SORTS.find((s) => s.value === f.sort)?.label ?? "Längste Laufzeit"}`}
            description={`Aktiv gesehen: ${windowLabel}${f.country ? ` · ${f.country}` : ""}${f.platform ? ` · ${platformLabel(f.platform)}` : ""}${termLabel ? ` · Stichwort „${termLabel.term}“` : ""}.`}
            action={
              advertiserParam ? (
                <Link href={rankHref(f, { view: "werbetreibende", sort: "active" })} className="text-xs font-medium text-accent hover:underline">
                  ← zur Rangliste
                </Link>
              ) : (
                <ProvenanceBadge kind="data" />
              )
            }
          />
          {ads.rows.length ? (
            <ul className="divide-y divide-border">
              {ads.rows.map((ad) => (
                <li key={ad.id} className="space-y-2 px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {ad.advertiser_id ? (
                      <Link href={`/ad-spy/rangliste?${new URLSearchParams({ werbetreibender: ad.advertiser_id, zeitraum: String(f.days) })}`} className="font-medium hover:text-accent">
                        {ad.advertiser_name ?? "Unbekannte Seite"}
                      </Link>
                    ) : (
                      <span className="font-medium">{ad.advertiser_name ?? "Unbekannte Seite"}</span>
                    )}
                    <span className="flex flex-wrap items-center gap-2">
                      {(ad.publisher_platforms ?? []).map((p) => (
                        <Badge key={p}>{platformLabel(p)}</Badge>
                      ))}
                      {ad.running_days !== null && ad.running_days >= LONG_RUNNING_DAYS ? <Badge tone="accent">Signal: lange Laufzeit</Badge> : null}
                    </span>
                  </div>
                  {ad.title ? <p className="font-medium">{ad.title}</p> : null}
                  {ad.body ? <p className="line-clamp-3 whitespace-pre-line text-muted">{ad.body}</p> : <p className="text-muted italic">Kein Anzeigentext gespeichert.</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>
                      Start {dateFmt(ad.started_at)}
                      {ad.running_days !== null ? ` · ${ad.running_days} Tage` : ""}
                    </span>
                    <span>Zuletzt aktiv gesehen {ad.last_seen ? new Date(`${ad.last_seen}T12:00:00Z`).toLocaleDateString("de-CH") : "–"} in {(ad.countries ?? []).join(", ")}</span>
                    {ad.eu_reach !== null ? <span>Reichweite EU {ad.eu_reach.toLocaleString("de-CH")}</span> : null}
                    <a href={libraryUrl(ad.external_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                      Anzeige ansehen <ExternalLink className="size-3" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <NoData />
          )}
        </Card>
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

function QuickLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("rounded-md border px-3 py-1 font-medium", active ? "border-accent bg-accent text-white" : "border-border text-muted hover:text-foreground")}>
      {children}
    </Link>
  );
}
