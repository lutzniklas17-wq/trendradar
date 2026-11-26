import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, PackageSearch, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, inputClass } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
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

  return (
    <>
      <PageHeader
        title="Produkte"
        description="Oben die Top-Hits aus echten Signalen, darunter die ganze Lieferanten-Bibliothek. Quelle: CJdropshipping API, täglich aktualisiert."
      />

      {notice ? <Notice tone="neutral">{notice}</Notice> : null}
      {migrationMissing ? <Notice>Die Produkt-Bibliothek ist noch nicht eingerichtet: Migration 0008_product_library.sql in Supabase ausführen.</Notice> : null}
      {!cj ? (
        <Notice tone="neutral">
          Für die Suche fehlt der CJ-Zugang (<code>CJ_API_KEY</code> in Vercel). Das CJ-Konto ist kostenlos, die Anleitung liegt in den Projektdateien. Bis dahin
          funktionieren die Links zu den Lieferanten unten.
        </Notice>
      ) : null}

      {/* Suche */}
      <Card className="mb-8">
        <form action={searchLibrary} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Produkt suchen (englisch, z. B. „posture corrector“)">
            <Input name="begriff" defaultValue={filters.term} placeholder="Suchbegriff" required minLength={2} maxLength={80} />
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

      {/* Top-Hits */}
      <section className="mb-10" aria-labelledby="top-hits">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="top-hits" className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" aria-hidden strokeWidth={1.75} /> Top-Hits
            </h2>
            <p className="mt-0.5 max-w-2xl text-[13px] text-muted">
              Rangliste nach Regeln: Übernahmen durch Shops, Wachstum seit letzter Woche, neu bei CJ, Meta-Anzeigen zum Stichwort
              {ai ? " und KI-Einschätzung." : ". KI-Einschätzung kommt dazu, sobald der Anthropic-Key gesetzt ist."}
            </p>
          </div>
          <Badge title="Ausgeschlossene, ausgeblendete und Produkte ohne Bild zählen nicht">{hits.length} Treffer</Badge>
        </div>
        {hits.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {hits.map(({ hit, product }, i) => (
              <ProductCard key={hit.id} product={product} claims={hit.claims} rank={i + 1} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={Sparkles} title="Noch keine Top-Hits">
              Top-Hits entstehen aus gesammelten Daten. Suche oben ein Produkt oder trage Begriffe für den täglichen Lauf ein. Das Wachstum („+40 Übernahmen in 7 Tagen“) sieht
              man nach etwa einer Woche täglicher Messung.
            </EmptyState>
          </Card>
        )}
      </section>

      {/* Bibliothek */}
      <Card className="mb-8">
        <CardHeader
          title="Bibliothek"
          description={`${new Intl.NumberFormat("de-CH").format(total)} gespeicherte Produkte. Steine, Rohstoffe, Ersatz- und Elektronikteile sind ausgeblendet (Filter „Relevanz“).`}
        />
        <FilterBar
          path="/produkte"
          query={filters.text}
          queryPlaceholder="In der Bibliothek filtern…"
          keep={filters.term ? { begriff: filters.term } : {}}
          controls={[{ kind: "select", name: "sortierung", label: "Sortierung", value: filters.sort, options: LIBRARY_SORTS }]}
          groups={[
            { title: "Preis", controls: [{ kind: "select", name: "preis", label: "Einkaufspreis", value: filters.maxPrice ? String(filters.maxPrice) : "", options: LIBRARY_PRICES }] },
            { title: "Relevanz", controls: [{ kind: "select", name: "relevanz", label: "Relevanz", value: filters.relevance, options: LIBRARY_RELEVANCE }] },
            {
              title: "Versand und Anzeige",
              controls: [
                { kind: "toggle", name: "gratisversand", label: "Gratisversand", checked: filters.freeShipping },
                { kind: "toggle", name: "ausgeblendet", label: "Ausgeblendete zeigen", checked: filters.showHidden },
              ],
            },
          ]}
          active={active}
          resultLabel={resultLabel(products.length, matching, ["Produkt", "Produkte"])}
        />
        <QuickChips
          items={[
            { label: "Meiste Übernahmen", href: chipHref({ sort: "" }), active: !filters.sort, title: "So oft haben Shops das Produkt bei CJ übernommen" },
            { label: "Neu beim Lieferanten", href: chipHref({ sort: "neu" }), active: filters.sort === "neu" },
            { label: "Von KI empfohlen", href: chipHref({ relevance: filters.relevance === "empfohlen" ? "" : "empfohlen" }), active: filters.relevance === "empfohlen", title: "Einschätzung, kein Fakt" },
            { label: "Gratisversand", href: chipHref({ freeShipping: !filters.freeShipping }), active: filters.freeShipping },
            { label: "Bis 10 USD", href: chipHref({ maxPrice: filters.maxPrice === 10 ? null : 10 }), active: filters.maxPrice === 10 },
          ]}
        />
        {filters.term ? (
          <div className="flex items-center gap-2 border-b border-border px-5 py-2 text-[13px] text-muted">
            Treffer für <Badge tone="accent">{filters.term}</Badge>
            <Link href="/produkte" className="text-accent hover:underline">
              Alle Produkte zeigen
            </Link>
          </div>
        ) : null}
        {products.length ? (
          <div className="space-y-3 border-t border-border bg-background p-4">
            {products.map((p) => (
              <LibraryProductRow key={p.id} product={p} ads={p.item_id ? (adCounts.get(p.item_id) ?? null) : null} />
            ))}
          </div>
        ) : active ? (
          <EmptyState icon={PackageSearch} title="Keine Einträge für diese Filter">
            <Link href="/produkte" className="text-accent hover:underline">
              Filter zurücksetzen
            </Link>
          </EmptyState>
        ) : (
          <EmptyState icon={PackageSearch} title="Die Bibliothek ist noch leer">
            Suche oben ein Produkt bei CJ oder lass den täglichen Lauf arbeiten. Jeder Treffer wird gespeichert.
          </EmptyState>
        )}
        {pages > 1 ? (
          <nav className="flex items-center justify-between border-t border-border px-5 py-3 text-[13px] text-muted" aria-label="Seiten">
            {filters.page > 1 ? (
              <Link href={`/produkte?${libraryQuery(filters, filters.page - 1)}`} scroll={false} className={buttonClass("secondary", "sm")}>
                <ChevronLeft className="size-3.5" aria-hidden /> Zurück
              </Link>
            ) : (
              <span />
            )}
            <span className="tabular-nums">
              Seite {filters.page} von {pages}
            </span>
            {filters.page < pages ? (
              <Link href={`/produkte?${libraryQuery(filters, filters.page + 1)}`} scroll={false} className={buttonClass("secondary", "sm")}>
                Weiter <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </Card>

      {/* Täglicher Lauf */}
      <Card>
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
