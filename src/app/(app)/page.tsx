import Link from "next/link";
import { Database, ExternalLink, Megaphone, Package, Store, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { WhatsNew } from "@/components/home/whats-new";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Segmented } from "@/components/ui/segmented";
import { Table, THead, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductRow } from "@/components/library/product-row";
import { AdCard, AdGrid, Monogram } from "@/components/ads/ad-card";
import { requireOwner } from "@/lib/auth";
import { getMetaEnv } from "@/lib/env";
import { dayCovers, domainUrl, itemAdCounts, HOME_TABS, homeHref, parseHomeParams, topAdsOfDay, weekdayShort, zurichDayRange, type HomeTab } from "@/lib/ads/feed";
import { zurichDay } from "@/lib/shops/shops";
import { cn } from "@/lib/utils";

type SourceRow = { id: string; name: string; last_success_at: string | null };
type ShopRow = {
  active_ads: number;
  capped: boolean;
  new_ads: number | null;
  longest_days: number | null;
  domains: Record<string, number> | null;
  tracked_shops: { id: string; name: string } | { id: string; name: string }[] | null;
};
type ProductRow = { id: string; name: string; image_url: string | null; website_url: string | null; category: string | null; first_discovered_at: string; source_url: string | null };

const dateTime = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });

const TAB_TEXT: Record<HomeTab, string> = {
  anzeigen: "Anzeigen, die TrendRadar an diesem Tag aktiv gesehen hat, sortiert nach EU-Reichweite laut Meta.",
  shops: "Verfolgte Shops mit den meisten aktiven Anzeigen in der EU, gezählt an diesem Tag.",
  produkte: "Produkte, die an diesem Tag neu in TrendRadar aufgenommen wurden.",
};

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const today = zurichDay();
  const { days, day, tab } = parseHomeParams(await searchParams, today);
  const { supabase } = await requireOwner();
  const canEmbed = Boolean(getMetaEnv());

  const [covers, sourcesRes] = await Promise.all([
    dayCovers(supabase, days),
    supabase.from("sources").select("id, name, last_success_at").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Start" description="Was heute auffällt: Anzeigen, Shops und Produkte aus deinen täglichen Sammelläufen." />

      <WhatsNew />

      <section aria-labelledby="top10" className="mb-6">
        <SectionHeader id="top10" icon={Trophy} title="Top 10 des Tages" description="Tag wählen, dann Anzeigen, Shops oder Produkte ansehen." />
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {[...covers].reverse().map((c) => {
            const active = c.day === day;
            return (
              <Link
                key={c.day}
                href={homeHref(c.day, tab, today)}
                aria-current={active ? "date" : undefined}
                className={cn(
                  "flex h-28 w-28 shrink-0 snap-start flex-col justify-between rounded-lg border p-3 transition-[border-color,box-shadow,background-color] duration-150",
                  active ? "border-accent bg-accent-soft ring-1 ring-accent/30" : "border-border bg-surface shadow-card hover:border-border-strong hover:shadow-card-hover",
                )}
              >
                <span className={cn("text-[12px]", active ? "text-accent" : "text-muted")}>{c.day === today ? "Heute" : weekdayShort(c.day)}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{c.day.slice(8, 10)}.</span>
                <span className="truncate text-[11px] text-muted" title={c.topAdvertiser ?? undefined}>
                  {c.ads ? `${c.ads.toLocaleString("de-CH")} Anzeigen` : "keine Daten"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Segmented label="Bereich" active={tab} items={HOME_TABS.map((t) => ({ value: t.value, label: t.label, href: homeHref(day, t.value, today) }))} />
        <p className="text-[13px] text-muted">{TAB_TEXT[tab]}</p>
      </div>

      <div className="mb-10">
        {tab === "anzeigen" ? <AdsTab day={day} canEmbed={canEmbed} /> : tab === "shops" ? <ShopsTab day={day} /> : <ProductsTab day={day} />}
      </div>

      <Card>
        <CardHeader title="Datenquellen" description="Wann jede Quelle zuletzt erfolgreich aktualisiert wurde." />
        {sourcesRes.error || !sourcesRes.data?.length ? (
          <EmptyState icon={Database} title="Noch keine Datenquellen eingerichtet">
            {sourcesRes.error ? "Die Datenbank ist noch nicht vorbereitet (Migration ausführen, siehe README)." : null}
          </EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Quelle</Th>
                <Th className="text-right">Zuletzt erfolgreich</Th>
              </tr>
            </THead>
            <tbody>
              {(sourcesRes.data as SourceRow[]).map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", s.last_success_at ? "bg-positive" : "bg-subtle")} aria-hidden />
                      {s.name}
                    </span>
                  </Td>
                  <Td className="text-right">
                    {s.last_success_at ? <span className="text-muted tabular-nums">{dateTime.format(new Date(s.last_success_at))}</span> : <Badge>noch nie</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

async function AdsTab({ day, canEmbed }: { day: string; canEmbed: boolean }) {
  const { supabase } = await requireOwner();
  const { cards, error } = await topAdsOfDay(supabase, day, 10);
  if (error || !cards.length) {
    return (
      <Card>
        <EmptyState icon={Megaphone} title={error ?? "Für diesen Tag wurden keine aktiven Anzeigen gesammelt"}>
          Anzeigen kommen aus dem täglichen Sammellauf (
          <Link href="/sammler" className="text-accent hover:underline">
            Stichwörter im Datensammler
          </Link>
          ), aus Live-Suchen mit Status „Aktiv“ und aus der Shop-Zählung. Ohne Meta-Token bleibt die Liste leer.
        </EmptyState>
      </Card>
    );
  }
  return (
    <>
      <AdGrid>
        {cards.map((ad, i) => (
          <AdCard key={ad.id} ad={ad} canEmbed={canEmbed} rank={i + 1} />
        ))}
      </AdGrid>
      <Link href="/ad-spy/rangliste?ansicht=anzeigen&sortierung=reach" className={buttonClass("secondary", "sm", "mt-4")}>
        Alle Anzeigen ansehen
      </Link>
    </>
  );
}

async function ShopsTab({ day }: { day: string }) {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("shop_snapshots")
    .select("active_ads, capped, new_ads, longest_days, domains, tracked_shops(id, name)")
    .eq("day", day)
    .order("active_ads", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as ShopRow[];
  if (error || !rows.length) {
    return (
      <Card>
        <EmptyState icon={Store} title={error ? "Shops konnten nicht geladen werden" : "Für diesen Tag gibt es keine Shop-Zählung"}>
          Die Zählung läuft täglich für alle Shops, die du im{" "}
          <Link href="/shop-spy" className="text-accent hover:underline">
            Shop Spy
          </Link>{" "}
          verfolgst.
        </EmptyState>
      </Card>
    );
  }
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => {
          const shop = Array.isArray(r.tracked_shops) ? r.tracked_shops[0] : r.tracked_shops;
          const domain = Object.entries(r.domains ?? {})
            .filter(([d]) => d)
            .sort((a, b) => b[1] - a[1])[0]?.[0];
          const url = domainUrl(domain ?? null);
          return (
            <li key={shop?.id ?? i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm transition-colors duration-150 hover:bg-surface-hover">
              <span className="w-5 text-[12px] text-subtle tabular-nums">{i + 1}</span>
              <Monogram name={shop?.name ?? null} />
              <div className="min-w-0 flex-1">
                {shop ? (
                  <Link href={`/shop-spy/${shop.id}`} className="block truncate font-medium transition-colors duration-150 hover:text-accent">
                    {shop.name}
                  </Link>
                ) : (
                  <span className="font-medium">Unbekannter Shop</span>
                )}
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-foreground">
                    {domain} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
              <Stat label="aktiv" value={`${r.capped ? "mind. " : ""}${r.active_ads.toLocaleString("de-CH")}`} />
              <Stat label="neu 7 T" value={r.new_ads !== null ? String(r.new_ads) : "–"} />
              <Stat label="längste" value={r.longest_days !== null ? `${r.longest_days} T` : "–"} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

async function ProductsTab({ day }: { day: string }) {
  const { supabase } = await requireOwner();
  const { from, to } = zurichDayRange(day);
  const { data, error } = await supabase
    .from("items")
    .select("id, name, image_url, website_url, category, first_discovered_at, source_url")
    .eq("type", "product")
    .gte("first_discovered_at", from)
    .lt("first_discovered_at", to)
    .order("first_discovered_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as ProductRow[];
  if (error || !rows.length) {
    return (
      <Card>
        <EmptyState icon={Package} title={error ? "Produkte konnten nicht geladen werden" : "An diesem Tag wurden keine Produkte aufgenommen"}>
          Neue Produkte kommen über den{" "}
          <Link href="/trend-spy" className="text-accent hover:underline">
            Trend Spy
          </Link>{" "}
          und die täglichen Sammelläufe.
        </EmptyState>
      </Card>
    );
  }
  const ads = await itemAdCounts(supabase, rows.map((r) => r.id));
  return (
    <div className="space-y-3">
      {rows.map((p, i) => (
        <ProductRow
          key={p.id}
          rank={i + 1}
          product={{ id: p.id, title: p.name, image_url: p.image_url, category_path: p.category, product_url: p.website_url, first_seen_at: p.first_discovered_at, item_id: p.id }}
          ads={ads.get(p.id) ?? null}
        />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="w-20 text-right">
      <span className="block text-sm font-medium tabular-nums">{value}</span>
      <span className="block text-[11px] text-muted">{label}</span>
    </span>
  );
}
