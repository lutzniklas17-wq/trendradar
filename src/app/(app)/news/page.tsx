import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, inputClass } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { SubmitButton } from "@/components/ui/submit-button";
import { NewsImage } from "@/components/news/news-image";
import { requireOwner } from "@/lib/auth";
import { filterNews, NEWS_SUGGESTIONS, splitSource, timeAgo } from "@/lib/news";
import { addNewsFeed, refreshNews, removeNewsFeed } from "./actions";

export const metadata: Metadata = { title: "Daily News" };
export const maxDuration = 120;

type Article = { id: string; title: string; source_name: string; image_url: string | null; excerpt: string | null; published_at: string | null; fetched_at: string };
type Feed = { id: string; name: string; url: string; last_run_at: string | null; last_count: number | null; last_error: string | null };

const PERIODS = [
  { value: "", label: "Letzte 30 Tage" },
  { value: "1", label: "Heute" },
  { value: "3", label: "Letzte 3 Tage" },
  { value: "7", label: "Letzte 7 Tage" },
] as const;

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const params = await searchParams;
  const notice = typeof params.hinweis === "string" ? params.hinweis.slice(0, 300) : null;
  const text = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const period = PERIODS.some((p) => p.value === params.zeitraum) ? String(params.zeitraum) : "";
  const source = typeof params.quelle === "string" ? params.quelle.slice(0, 100) : "";
  const { supabase } = await requireOwner();

  const [articlesRes, feedsRes] = await Promise.all([
    supabase.from("news_articles").select("id, title, source_name, image_url, excerpt, published_at, fetched_at").order("fetched_at", { ascending: false }).limit(300),
    supabase.from("feeds").select("id, name, url, last_run_at, last_count, last_error").eq("kind", "news").order("name"),
  ]);
  const migrationMissing = Boolean(articlesRes.error || feedsRes.error);
  const all = ((articlesRes.data ?? []) as Article[])
    .map((a) => {
      const split = splitSource(a.title);
      return { ...a, title: split.title, publisher: split.source ?? a.source_name, date: a.published_at ?? a.fetched_at };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const articles = filterNews(all, { text, source, days: Number(period) || 0 });
  const feeds = (feedsRes.data ?? []) as Feed[];
  const [lead, ...rest] = articles;
  const usedSuggestions = new Set(feeds.map((f) => f.url));

  return (
    <>
      <PageHeader
        title="Daily News"
        description="E-Commerce-News aus deinen Feeds, täglich um ca. 05:45 aktualisiert. Gezeigt werden Titel, Bild und Anrisstext aus dem Feed; der ganze Artikel bleibt beim Verlag (Urheberrecht)."
      >
        {feeds.length ? (
          <form action={refreshNews}>
            <SubmitButton variant="secondary" pendingLabel="Lädt …">
              Jetzt aktualisieren
            </SubmitButton>
          </form>
        ) : null}
      </PageHeader>

      {notice ? <Notice tone="neutral">{notice}</Notice> : null}
      {migrationMissing ? <Notice>Die Tabellen fehlen noch. Bitte die Migrationen 0004 und 0006 in Supabase ausführen.</Notice> : null}

      {all.length ? (
        <div className="mb-6">
          <FilterBar
            path="/news"
            query={text}
            queryPlaceholder="Stichwort im Titel…"
            active={Boolean(text || period || source)}
            resultLabel={`${articles.length} von ${all.length} Artikeln`}
            controls={[
              { kind: "select", name: "zeitraum", label: "Zeitraum", value: period, options: PERIODS },
              { kind: "select", name: "quelle", label: "Feed", value: source, options: [{ value: "", label: "Alle Feeds" }, ...feeds.map((f) => ({ value: f.name, label: f.name }))] },
            ]}
          />
        </div>
      ) : null}

      {lead ? (
        <div className="space-y-6">
          <Link href={`/news/${lead.id}`} className="group grid overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-colors duration-150 hover:border-border-strong md:grid-cols-2">
            <NewsImage src={lead.image_url} alt="" className="aspect-[16/9] w-full md:aspect-auto md:h-full" />
            <div className="flex flex-col justify-center gap-2 p-5">
              <p className="text-[13px] text-muted">
                {lead.publisher} · {timeAgo(lead.date)}
              </p>
              <h2 className="text-xl font-medium leading-snug group-hover:text-accent">{lead.title}</h2>
              {lead.excerpt ? <p className="line-clamp-3 text-sm text-muted">{lead.excerpt}</p> : null}
            </div>
          </Link>

          {rest.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-colors duration-150 hover:border-border-strong">
                    <NewsImage src={a.image_url} alt="" className="aspect-[16/9] w-full" />
                    <div className="flex flex-1 flex-col gap-1.5 p-4">
                      <p className="text-xs text-muted">
                        {a.publisher} · {timeAgo(a.date)}
                      </p>
                      <h3 className="line-clamp-3 text-sm font-medium leading-snug group-hover:text-accent">{a.title}</h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Newspaper} title={all.length ? "Keine Artikel für diese Filter" : "Noch keine News"}>
            {all.length ? (
              <Link href="/news" className="text-accent hover:underline">
                Filter zurücksetzen
              </Link>
            ) : (
              "Füge unten einen News-Feed hinzu (zum Beispiel einen der Vorschläge) und klicke auf „Jetzt aktualisieren“. Es werden keine Beispieldaten angezeigt."
            )}
          </EmptyState>
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader
          title="News-Feeds"
          description="Nur RSS/Atom-Feeds, die zum Abonnieren gedacht sind. Viele Zeitungen haben einen RSS-Link pro Ressort (z. B. Wirtschaft); den kannst du hier eintragen. Google News liefert meist keine Bilder, Verlags-Feeds oft schon."
        />
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
          {NEWS_SUGGESTIONS.map((s) => (
            <form key={s.id} action={addNewsFeed}>
              <input type="hidden" name="vorschlag" value={s.id} />
              <SubmitButton variant="secondary" size="sm" disabled={usedSuggestions.has(s.url)} title={usedSuggestions.has(s.url) ? "Schon hinzugefügt" : undefined}>
                + {s.name}
              </SubmitButton>
            </form>
          ))}
        </div>
        <form action={addNewsFeed} className="grid gap-3 border-t border-border p-5 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
          <Field label="Feed-Adresse (https)">
            <input name="url" type="url" required maxLength={1000} className={inputClass} placeholder="https://…/rss" />
          </Field>
          <Field label="Name">
            <input name="name" maxLength={100} className={inputClass} placeholder="z. B. Handelszeitung" />
          </Field>
          <Field label="Nur mit Wörtern (optional)">
            <input name="stichwoerter" maxLength={2000} className={inputClass} placeholder="onlineshop, marke" />
          </Field>
          <SubmitButton>Hinzufügen</SubmitButton>
        </form>
        {feeds.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {feeds.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted">
                    {f.last_run_at ? `zuletzt ${timeAgo(f.last_run_at)}, ${f.last_count ?? 0} Einträge im Feed` : "noch nicht gelesen"}
                  </p>
                  {f.last_error ? <p className="text-xs text-warning">{f.last_error}</p> : null}
                </div>
                <form action={removeNewsFeed}>
                  <input type="hidden" name="id" value={f.id} />
                  <SubmitButton variant="ghost" size="sm" title={`${f.name} entfernen`}>
                    <Trash2 className="size-4" />
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>
  );
}
