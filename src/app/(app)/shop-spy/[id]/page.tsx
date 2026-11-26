import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ShopChart } from "@/components/shops/shop-chart";
import { requireOwner } from "@/lib/auth";
import { getMetaEnv } from "@/lib/env";
import { libraryPageUrl, PAGE_ADS_LIMIT } from "@/lib/ads/meta";
import { formatCount, MAX_PAGES_PER_SHOP, shopTrend, sortedDomains } from "@/lib/shops/shops";
import { refreshShop, removeShop } from "../actions";

export const metadata: Metadata = { title: "Shop" };
export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SnapRow = {
  day: string;
  active_ads: number;
  capped: boolean;
  domains: Record<string, number> | null;
  new_ads: number | null;
  longest_days: number | null;
};

export default async function ShopPage({ params }: PageProps<"/shop-spy/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireOwner();
  const { data: shop } = await supabase
    .from("tracked_shops")
    .select("id, page_id, name, created_at, last_checked_at, last_error")
    .eq("id", id)
    .maybeSingle();
  if (!shop) notFound();
  const { data } = await supabase
    .from("shop_snapshots")
    .select("day, active_ads, capped, domains, new_ads, longest_days")
    .eq("shop_id", id)
    .order("day", { ascending: true })
    .limit(400);
  const snaps = (data ?? []) as SnapRow[];
  const latest = snaps[snaps.length - 1] ?? null;
  const trend = shopTrend(snaps.map((s) => ({ day: s.day, activeAds: s.active_ads, capped: s.capped })));
  const domains = sortedDomains(latest?.domains ?? {});
  const withoutDomain = latest?.domains?.[""] ?? 0;
  const configured = getMetaEnv() !== null;

  return (
    <>
      <PageHeader title={shop.name} description={`Facebook-Seite ${shop.page_id} · nur Anzeigen, die in der EU laufen`} />
      <p className="-mt-4 mb-6 text-sm">
        <Link href="/shop-spy" className="text-accent hover:underline">
          ← Alle Shops
        </Link>
      </p>

      {shop.last_error ? (
        <Card className="mb-6 border-warning/40">
          <p className="px-5 py-3 text-sm text-warning">Letzte Zählung fehlgeschlagen: {shop.last_error}</p>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Aktive Anzeigen (EU)" value={latest ? formatCount(latest.active_ads, latest.capped) : "–"} hint={latest ? `Stand ${fmtDay(latest.day)}` : "noch nicht gezählt"} />
        <Stat
          label="Veränderung"
          value={trend?.delta === null || trend?.delta === undefined ? "–" : `${trend.delta > 0 ? "+" : ""}${trend.delta}`}
          hint={trend?.previous ? `seit ${fmtDay(trend.previous.day)} (${trend.previous.activeAds})` : "Vergleich ab 7 Tagen Verlauf"}
        />
        <Stat
          label="Neu in 7 Tagen"
          value={latest?.new_ads?.toString() ?? "–"}
          hint={latest?.longest_days !== null && latest?.longest_days !== undefined ? `längste läuft ${latest.longest_days} Tage` : ""}
        />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Verlauf aktive Anzeigen"
            description="Ein Messpunkt pro Tag. Tage ohne Zählung fehlen und werden nicht geschätzt."
            action={
              trend?.scaling ? (
                <Badge tone="accent">Signal: skaliert</Badge>
              ) : trend?.dropping ? (
                <Badge tone="warning">stark rückläufig</Badge>
              ) : (
                <ProvenanceBadge kind="data" />
              )
            }
          />
          {snaps.length >= 2 ? (
            <div className="p-5">
              <ShopChart points={snaps.map((s) => ({ day: s.day, activeAds: s.active_ads }))} />
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">
              {snaps.length ? "Erst ein Messpunkt. Der Verlauf erscheint ab dem zweiten Tag." : "Noch keine Zählung."}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Domains in den aktiven Anzeigen"
            description="Aus der Link-Beschriftung der Anzeigen. Meist die Shop-Domain, aber nicht garantiert; eine echte Landingpage-URL liefert Meta nicht."
          />
          {domains.length ? (
            <ul className="divide-y divide-border">
              {domains.map((d) => (
                <li key={d.domain} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-accent">
                    {d.domain} <ExternalLink className="size-3" />
                  </a>
                  <span className="text-muted">{d.count} Anzeigen</span>
                </li>
              ))}
              {withoutDomain ? (
                <li className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-muted">
                  <span>ohne erkennbare Domain</span>
                  <span>{withoutDomain} Anzeigen</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">Keine Domain erkannt.</p>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
            {configured ? (
              <form action={refreshShop}>
                <input type="hidden" name="id" value={shop.id} />
                <SubmitButton pendingLabel="Zähle…">Jetzt neu zählen</SubmitButton>
              </form>
            ) : (
              <span className="text-muted">Meta-API nicht verbunden, Zählen nicht möglich.</span>
            )}
            <a href={libraryPageUrl(shop.page_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              Alle Anzeigen in der Ad Library <ExternalLink className="size-3" />
            </a>
            <form action={removeShop} className="ml-auto">
              <input type="hidden" name="id" value={shop.id} />
              <SubmitButton variant="danger" pendingLabel="Wird entfernt…">
                Nicht mehr verfolgen
              </SubmitButton>
            </form>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            Gezählt werden alle aktiven Anzeigen dieser Seite in den EU-Ländern, höchstens {MAX_PAGES_PER_SHOP * PAGE_ADS_LIMIT} pro Zählung (darüber
            steht „mind.“). Anzeigen nur für die Schweiz oder ausserhalb der EU sind nicht enthalten. Ausgaben und Umsatz veröffentlicht
            Meta für Produktanzeigen nicht.
          </p>
        </Card>
      </div>
    </>
  );
}

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("de-CH", { timeZone: "UTC" });

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
