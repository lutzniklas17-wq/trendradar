import Link from "next/link";
import { ExternalLink, Megaphone } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClass } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { AD_COUNTRIES, libraryPageUrl, libraryUrl } from "@/lib/ads/meta";
import type { LinkedAd, LinkedAdvertiser } from "@/lib/links";
import { addWatchTerm } from "@/app/(app)/sammler/actions";

const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }) : "unbekannt");

type Term = { id: string; term: string; country: string; last_count: number | null; last_run_at: string | null };

/** Produkt ↔ Anzeigen ↔ Shops ↔ Google Trends, aus gespeicherten Daten. */
export function MarketSection({
  item,
  terms,
  ads,
  advertisers,
  trendFetchedAt,
}: {
  item: { id: string; name: string };
  terms: Term[];
  ads: LinkedAd[];
  advertisers: LinkedAdvertiser[];
  trendFetchedAt: string | null;
}) {
  const q = encodeURIComponent(item.name.slice(0, 100));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Anzeigen zu diesem Produkt täglich sammeln"
          description="Der Sammellauf fragt jeden Tag die aktiven Meta-Anzeigen zu diesen Stichwörtern ab. Daraus entstehen die Werbetreibenden und Anzeigen unten."
        />
        <form action={addWatchTerm} className="flex flex-wrap items-end gap-3 border-t border-border p-5">
          <input type="hidden" name="item" value={item.id} />
          <input type="hidden" name="zurueck" value={`/produkt/${item.id}`} />
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Stichwort (in der Sprache des Landes)</span>
            <input name="begriff" required maxLength={100} defaultValue={item.name.slice(0, 100)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Land</span>
            <select name="land" defaultValue="DE" className={inputClass}>
              {AD_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton>Täglich sammeln</SubmitButton>
        </form>
        {terms.length ? (
          <ul className="divide-y divide-border border-t border-border text-sm">
            {terms.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="font-medium">{t.term}</span> <Badge>{t.country}</Badge>
                  <span className="ml-2 text-xs text-muted">
                    {t.last_run_at ? `zuletzt ${dateFmt(t.last_run_at)}, ${t.last_count ?? 0} aktive Anzeigen` : "noch nicht abgefragt"}
                  </span>
                </span>
                <Link href={`/ad-spy/rangliste?stichwort=${t.id}`} className="text-xs font-medium text-accent hover:underline">
                  Rangliste für dieses Stichwort
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Wer bewirbt das Produkt?"
          description="Werbetreibende mit gespeicherten Anzeigen zu diesem Produkt (über die Stichwörter oder weil der Produktname im Anzeigentext steht)."
          action={<ProvenanceBadge kind="data" />}
        />
        {advertisers.length ? (
          <ul className="divide-y divide-border text-sm">
            {advertisers.slice(0, 12).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <Link href={`/ad-spy/rangliste?werbetreibender=${a.id}&zeitraum=30`} className="font-medium hover:text-accent">
                  {a.name}
                </Link>
                <span className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted">{a.ads} gespeicherte Anzeigen</span>
                  {a.trackedShopId ? (
                    <Link href={`/shop-spy/${a.trackedShopId}`} className="font-medium text-accent hover:underline">
                      Im Shop Spy
                    </Link>
                  ) : null}
                  <a href={libraryPageUrl(a.pageId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Ad Library <ExternalLink className="size-3" />
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Megaphone} title="Noch keine gespeicherten Anzeigen">
            Oben „Täglich sammeln“ oder direkt im{" "}
            <Link href={`/ad-spy?q=${q}`} prefetch={false} className="text-accent hover:underline">
              Ad Spy suchen
            </Link>
            . Es werden keine Beispieldaten gezeigt.
          </EmptyState>
        )}
        {ads.length ? (
          <div className="border-t border-border">
            <p className="px-5 pt-3 text-xs font-medium text-muted">Am längsten laufende gespeicherte Anzeigen</p>
            <ul className="divide-y divide-border text-sm">
              {[...ads]
                .sort((a, b) => (a.started_at ?? "9").localeCompare(b.started_at ?? "9"))
                .slice(0, 5)
                .map((ad) => (
                  <li key={ad.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="font-medium">{ad.advertiser?.name ?? "Unbekannte Seite"}</span>
                      <span className="ml-2 text-muted">{ad.title ?? ad.body?.slice(0, 80) ?? ""}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted">
                      seit {dateFmt(ad.started_at)}
                      <a href={libraryUrl(ad.external_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                        ansehen <ExternalLink className="size-3" />
                      </a>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Google Trends"
          description={
            trendFetchedAt
              ? `Suchinteresse zuletzt abgefragt am ${dateFmt(trendFetchedAt)} (Zwischenspeicher 24 h).`
              : "Für dieses Produkt wurde das Suchinteresse noch nicht abgefragt."
          }
          action={
            <Link href={`/google-trends?q=${q}`} prefetch={false} className="text-sm font-medium text-accent hover:underline">
              Kurve öffnen →
            </Link>
          }
        />
      </Card>
    </div>
  );
}
