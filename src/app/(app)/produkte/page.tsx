import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, PackageSearch, RefreshCw, Search, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, inputClass } from "@/components/ui/field";
import { BrowseHeader } from "@/components/layout/browse-header";
import { FilterPanel, type PanelGroup } from "@/components/ui/filter-panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { LibraryProductRow, ProductCard, type LibraryProduct } from "@/components/library/product-card";
import { QuickChips } from "@/components/ui/quick-chips";
import { itemAdCounts } from "@/lib/ads/feed";
import { requireOwner } from "@/lib/auth";
import { getAnthropicEnv, getCjEnv } from "@/lib/env";
import { SUPPLIER_PLATFORMS } from "@/lib/platforms";
import { LIBRARY_COLUMNS, loadTopHits } from "@/lib/library/load";
import { zurichDay } from "@/lib/shops/shops";
import {
  hasLibraryFilters,
  LIBRARY_PAGE_SIZE,
  LIBRARY_PRICES,
  LIBRARY_RELEVANCE,
  LIBRARY_SORTS,
  libraryQuery,
  likePattern,
  parseLibraryFilters,
  resultLabel,
} from "@/lib/list-filters";
import { addLibraryTerm, removeLibraryTerm, runLibraryNow, searchLibrary } from "./actions";

export const metadata: Metadata = { title: "Produkte" };
// Live-Suche und „Jetzt aktualisieren“ warten auf CJ (1 Anfrage pro Sekunde).
export const maxDuration = 300;


const COUNTRY_OPTIONS = [
  { value: "", label: "Alle Lager" },
  { value: "DE", label: "Lager in Deutschland" },
  { value: "FR", label: "Lager in Frankreich" },
  { value: "GB", label: "Lager in Grossbritannien" },
  { value: "US", label: "Lager in den USA" },
  { value: "CN", label: "Lager in China" },
] as const;

const dateFormat = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });

type Term = { id: string; term: string; last_run_at: string | null; last_count: number | null; last_error: string | null };

export default async function ProduktePage({ searchParams }: PageProps<"/produkte">) {
  const params = await searchParams;
  const filters = parseLibraryFilters(params);
  const notice = typeof params.hinweis === "string" ? params.hinweis.slice(0, 300) : null;
  const { supabase } = await requireOwner();
  const cj = getCjEnv();
  const ai = getAnthropicEnv() !== null;

  // Bibliothek mit Filtern (in der Datenbank, damit auch grosse Bestände schnell bleiben)
  let q = supabase.from("supplier_products").select(`${LIBRARY_COLUMNS}, listed_at, first_seen_at`, { count: "exact" });
  if (!filters.showHidden) q = q.eq("hidden", false);
  const like = likePattern(filters.text);
  if (like) q = q.ilike("title", like);
  if (filters.term) q = q.contains("search_terms", [filters.term]);
  if (filters.maxPrice) q = q.lte("price", filters.maxPrice);
  if (filters.freeShipping) q = q.eq("free_shipping", true);
  if (filters.relevance === "") q = q.neq("relevance", "irrelevant").or("ai_relevant.is.null,ai_relevant.eq.true");
  if (filters.relevance === "empfohlen") q = q.gte("ai_score", 4).eq("ai_relevant", true);
  if (filters.relevance === "unklar") q = q.eq("relevance", "unclear");
  if (filters.relevance === "ausgeschlossen") q = q.or("relevance.eq.irrelevant,ai_relevant.eq.false");
  if (filters.sort === "neu") q = q.order("listed_at", { ascending: false, nullsFirst: false });
  else if (filters.sort === "gefunden") q = q.order("first_seen_at", { ascending: false });
  else if (filters.sort === "preis") q = q.order("price", { ascending: true, nullsFirst: false });
  else if (filters.sort === "ki") q = q.order("ai_score", { ascending: false, nullsFirst: false });
  q = q.order("listed_count", { ascending: false, nullsFirst: false }).order("id");
  const from = (filters.page - 1) * LIBRARY_PAGE_SIZE;
  q = q.range(from, from + LIBRARY_PAGE_SIZE - 1);

  const [hits, libRes, totalRes, termsRes, usageRes] = await Promise.all([
    loadTopHits(supabase),
    q,
    supabase.from("supplier_products").select("id", { count: "exact", head: true }),
    supabase.from("library_terms").select("id, term, last_run_at, last_count, last_error").order("term"),
    supabase.from("api_usage").select("provider, calls, cost_usd").eq("day", zurichDay()),
  ]);
  const migrationMissing = Boolean(libRes.error && totalRes.error);


  const products = (libRes.data ?? []) as unknown as (LibraryProduct & { listed_at: string | null; first_seen_at: string | null })[];
  const adCounts = await itemAdCounts(supabase, products.map((p) => p.item_id).filter((x): x is string => Boolean(x)));
  const chipHref = (change: Partial<typeof filters>) => {
    const q = libraryQuery({ ...filters, ...change }, 1);
    return q ? `/produkte?${q}` : "/produkte";
  };
  const matching = libRes.count ?? products.length;
  const total = totalRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(matching / LIBRARY_PAGE_SIZE));
  const terms = (termsRes.data ?? []) as Term[];
  const usage = (usageRes.data ?? []) as { provider: string; calls: number; cost_usd: number }[];
  const cjCalls = usage.find((u) => u.provider === "cj")?.calls ?? 0;
  const aiCost = Number(usage.find((u) => u.provider === "anthropic")?.cost_usd ?? 0);
  const active = hasLibraryFilters(filters);
  const externalQuery = filters.term || filters.text;

  const opt = <T extends { value: string; label: string }>(list: readonly T[], current: string, key: keyof typeof filters, map: (v: string) => unknown = (v) => v) =>
    list.map((o) => ({ label: o.label, active: o.value === current, href: chipHref({ [key]: map(o.value) } as Partial<typeof filters>) }));
  const panelGroups: PanelGroup[] = [
    {
      title: "Produkt",
      items: [
        { kind: "choice", icon: "sort", label: "Sortierung", options: opt(LIBRARY_SORTS, filters.sort, "sort") },
        { kind: "choice", icon: "price", label: "Einkaufspreis", options: opt(LIBRARY_PRICES, filters.maxPrice ? String(filters.maxPrice) : "", "maxPrice", (v) => (v ? Number(v) : null)) },
      ],
    },
    {
      title: "Relevanz",
      items: [{ kind: "choice", icon: "sparkles", label: "Relevanz und KI", options: opt(LIBRARY_RELEVANCE, filters.relevance, "relevance") }],
    },
    {
      title: "Versand",
      items: [{ kind: "toggle", icon: "truck", label: "Gratisversand", href: chipHref({ freeShipping: !filters.freeShipping }), active: filters.freeShipping }],
    },
    {
      title: "Ansicht",
      items: [{ kind: "toggle", icon: "eye", label: "Ausgeblendete zeigen", href: chipHref({ showHidden: !filters.showHidden }), active: filters.showHidden }],
    },
  ];

  return (
    <>
      <BrowseHeader
        icon={ShoppingBag}
        title="Produkte"
        accent="entdecken"
        description={`${new Intl.NumberFormat("de-CH").format(total)} Produkte aus Lieferanten-Katalogen, täglich aktualisiert.`}
        action={
          <a href="#update" className={buttonClass("secondary", "sm", "rounded-full px-3.5")}>
            <RefreshCw className="size-3.5 text-accent" aria-hidden /> Tägliches Update
          </a>
        }
      />

      {notice ? <Notice tone="neutral">{notice}</Notice> : null}
      {migrationMissing ? <Notice>Die Produkt-Bibliothek ist noch nicht eingerichtet: Migration 0008_product_library.sql in Supabase ausführen.</Notice> : null}
      {!cj ? (
        <Notice tone="neutral">
          Für die Suche fehlt der CJ-Zugang (<code>CJ_API_KEY</code> in Vercel). Das CJ-Konto ist kostenlos, die Anleitung liegt in den Projektdateien. Bis dahin
          funktionieren die Links zu den Lieferanten unten.
        </Notice>
      ) : null}

      {/* Top-Hits als Karussell */}
      <section className="mb-8" aria-labelledby="top-hits">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="top-hits" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-4 text-accent" aria-hidden strokeWidth={1.75} /> Top-Hits
          </h2>
          <p className="max-w-2xl text-[13px] text-muted">
            Nach Regeln: Übernahmen durch Shops, Wachstum seit letzter Woche, neu beim Lieferanten, Meta-Anzeigen zum Stichwort{ai ? ", KI-Einschätzung" : ""}.
          </p>
        </div>
        {hits.length ? (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
            {hits.map(({ hit, product }, i) => (
              <div key={hit.id} className="w-56 shrink-0 snap-start">
                <ProductCard product={product} claims={hit.claims} rank={i + 1} />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={Sparkles} title="Noch keine Top-Hits">
              Top-Hits entstehen aus gesammelten Daten. Suche unten ein Produkt oder trage Begriffe für den täglichen Lauf ein. Das Wachstum („+40 Übernahmen in 7 Tagen“) sieht
              man nach etwa einer Woche täglicher Messung.
            </EmptyState>
          </Card>
        )}
      </section>

      {/* Suche in der Bibliothek */}
      <form action="/produkte" className="flex flex-wrap gap-2" role="search">
        {filters.term ? <input type="hidden" name="begriff" value={filters.term} /> : null}
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Produkte durchsuchen</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            name="filter"
            type="search"
            defaultValue={filters.text}
            placeholder="Nach Produktname suchen, z. B. „posture corrector“"
            className={`${inputClass} h-12 rounded-xl pl-11 text-[15px] shadow-xs`}
          />
        </label>
        <button type="submit" className={buttonClass("primary", "md", "h-12 rounded-xl px-5")}>
          Suchen
        </button>
      </form>

      <QuickChips
        items={[
          { label: "Meiste Übernahmen", href: chipHref({ sort: "" }), active: !filters.sort, title: "So oft haben Shops das Produkt beim Lieferanten übernommen" },
          { label: "Neu beim Lieferanten", href: chipHref({ sort: "neu" }), active: filters.sort === "neu" },
          { label: "Von KI empfohlen", href: chipHref({ relevance: filters.relevance === "empfohlen" ? "" : "empfohlen" }), active: filters.relevance === "empfohlen", title: "Einschätzung, kein Fakt" },
          { label: "Gratisversand", href: chipHref({ freeShipping: !filters.freeShipping }), active: filters.freeShipping },
          { label: "Bis 10 USD", href: chipHref({ maxPrice: filters.maxPrice === 10 ? null : 10 }), active: filters.maxPrice === 10 },
        ]}
        className="px-0"
      />

      <FilterPanel groups={panelGroups} resetHref="/produkte" active={active} />

      {/* Ergebnisse */}
      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted tabular-nums">
          {resultLabel(products.length, matching, ["Produkt", "Produkte"])}
          {filters.term ? (
            <>
              {" "}
              für <Badge tone="accent">{filters.term}</Badge>{" "}
              <Link href="/produkte" className="text-accent hover:underline">
                alle zeigen
              </Link>
            </>
          ) : null}
        </p>
        {pages > 1 ? (
          <span className="text-[13px] text-muted tabular-nums">
            Seite {filters.page} von {pages}
          </span>
        ) : null}
      </div>

      {products.length ? (
        <div className="space-y-3">
          {products.map((p) => (
            <LibraryProductRow key={p.id} product={p} ads={p.item_id ? (adCounts.get(p.item_id) ?? null) : null} />
          ))}
        </div>
      ) : (
        <Card>
          {active ? (
            <EmptyState icon={PackageSearch} title="Keine Einträge für diese Filter">
              <Link href="/produkte" className="text-accent hover:underline">
                Filter zurücksetzen
              </Link>
            </EmptyState>
          ) : (
            <EmptyState icon={PackageSearch} title="Die Bibliothek ist noch leer">
              Suche unten ein Produkt beim Lieferanten oder lass den täglichen Lauf arbeiten. Jeder Treffer wird gespeichert.
            </EmptyState>
          )}
        </Card>
      )}

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-[13px] text-muted" aria-label="Seiten">
          {filters.page > 1 ? (
            <Link href={`/produkte?${libraryQuery(filters, filters.page - 1)}`} className={buttonClass("secondary", "sm")}>
              <ChevronLeft className="size-3.5" aria-hidden /> Zurück
            </Link>
          ) : (
            <span />
          )}
          <span className="tabular-nums">
            Seite {filters.page} von {pages}
          </span>
          {filters.page < pages ? (
            <Link href={`/produkte?${libraryQuery(filters, filters.page + 1)}`} className={buttonClass("secondary", "sm")}>
              Weiter <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {/* Neue Produkte beim Lieferanten suchen */}
      <Card className="mt-10 mb-8">
        <CardHeader title="Neue Produkte beim Lieferanten suchen" description="Fragt den Katalog live ab und speichert alle Treffer in der Bibliothek (zählt zum Tageslimit)." />
        <form action={searchLibrary} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Suchbegriff (englisch)">
            <Input name="begriff" defaultValue={filters.term} placeholder="z. B. pet hair remover" required minLength={2} maxLength={80} />
          </Field>
          <Field label="Lager">
            <Select name="lager" options={COUNTRY_OPTIONS} defaultValue="" />
          </Field>
          <SubmitButton disabled={!cj} title={!cj ? "CJ_API_KEY fehlt" : undefined} pendingLabel="Suche bei CJ …">
            <PackageSearch className="size-4" aria-hidden /> Bei CJ suchen
          </SubmitButton>
          <label className="flex items-center gap-2 text-[13px] text-muted sm:col-span-3">
            <input type="checkbox" name="taeglich" value="1" className="accent-(--accent)" />
            Diesen Begriff täglich automatisch aktualisieren
          </label>
        </form>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-5 py-3 text-[13px] text-muted">
          <span>Auch ansehen bei</span>
          {SUPPLIER_PLATFORMS.filter((p) => p.id !== "cj").map((p) =>
            externalQuery ? (
              <a key={p.id} href={p.searchUrl(externalQuery)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                {p.name} <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : (
              <span key={p.id} className="text-subtle" title="Zuerst einen Begriff suchen oder filtern">
                {p.name}
              </span>
            ),
          )}
          <span className="text-subtle">(nur Links: ohne offizielle API keine Daten)</span>
        </div>
      </Card>

      {/* Täglicher Lauf */}
      <Card id="update" className="scroll-mt-20">
        <CardHeader
          title="Tägliches Update"
          description={`Jeden Morgen holt der Lauf die CJ-Trend- und Neuheitenliste und alle Begriffe unten. Heute ${cjCalls} von ${cj?.dailyLimit ?? 300} CJ-Abfragen genutzt${ai ? `, KI-Kosten heute ${aiCost.toFixed(3)} USD` : ""}.`}
          action={
            <form action={runLibraryNow}>
              <SubmitButton variant="secondary" size="sm" disabled={!cj} title={!cj ? "CJ_API_KEY fehlt" : undefined} pendingLabel="Läuft, bis zu 2 Min. …">
                <RefreshCw className="size-3.5" aria-hidden /> Jetzt aktualisieren
              </SubmitButton>
            </form>
          }
        />
        <form action={addLibraryTerm} className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <input name="begriff" required minLength={2} maxLength={80} placeholder="Neuer Begriff, z. B. „pet hair remover“" aria-label="Neuer Begriff" className={`${inputClass} h-8 max-w-sm flex-1 text-[13px]`} />
          <SubmitButton variant="secondary" size="sm">
            Hinzufügen
          </SubmitButton>
        </form>
        {terms.length ? (
          <ul className="divide-y divide-border">
            {terms.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                <Link href={`/produkte?begriff=${encodeURIComponent(t.term)}`} className="font-medium hover:text-accent">
                  {t.term}
                </Link>
                <span className="flex items-center gap-3 text-[13px] text-muted">
                  {t.last_error ? (
                    <Badge tone="warning" title={t.last_error}>
                      Fehler
                    </Badge>
                  ) : null}
                  <span className="tabular-nums">{t.last_run_at ? `${t.last_count ?? 0} Treffer · ${dateFormat.format(new Date(t.last_run_at))}` : "noch nicht gelaufen"}</span>
                  <form action={removeLibraryTerm}>
                    <input type="hidden" name="id" value={t.id} />
                    <SubmitButton variant="danger" size="sm" className="px-2" title="Begriff entfernen">
                      <Trash2 className="size-3.5" aria-label="Begriff entfernen" />
                    </SubmitButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted">Noch keine Begriffe. Ohne Begriffe holt der Lauf nur die Trend- und Neuheitenliste von CJ.</p>
        )}
      </Card>
    </>
  );
}
