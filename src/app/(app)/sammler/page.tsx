import type { Metadata } from "next";
import { Bot, Play, Rss, Tag, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClass } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOwner } from "@/lib/auth";
import { getAliExpressEnv, getAnthropicEnv, getCjEnv, getMetaEnv, getProductHuntEnv } from "@/lib/env";
import { AD_COUNTRIES } from "@/lib/ads/meta";
import { addFeed, addWatchTerm, removeFeed, removeWatchTerm, runCollectorNow, toggleWatchTerm } from "./actions";

export const metadata: Metadata = { title: "Datensammler" };
// „Jetzt ausführen“ fragt mehrere Stichwörter oder Feeds nacheinander ab.
export const maxDuration = 300;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" }) : "noch nie";

const AREA_LABEL: Record<string, string> = { trend_spy: "Trend Spy", startup_spy: "Startup Spy", future_radar: "Future Radar" };
const JOB_LABEL: Record<string, string> = { ads: "Anzeigen", producthunt: "Product Hunt", rss: "RSS-Feeds", shops: "Shops", library: "Produkt-Bibliothek", ai: "KI-Bewertung", startups: "Startups", news: "News" };

type Term = { id: string; term: string; country: string; active: boolean; last_run_at: string | null; last_count: number | null; last_error: string | null; items: { name: string } | null };
type Feed = { id: string; url: string; name: string; area: string; keywords: string[]; last_run_at: string | null; last_count: number | null; last_error: string | null };
type Run = { id: string; job: string | null; started_at: string; status: string; new_items: number; log: { message?: string } | null };

function RunButton({ job, disabled, label, reason }: { job: string; disabled?: boolean; label: string; reason?: string }) {
  return (
    <form action={runCollectorNow}>
      <input type="hidden" name="job" value={job} />
      <SubmitButton variant="secondary" disabled={disabled} title={disabled ? reason : undefined} pendingLabel="Läuft …">
        <Play className="size-4" /> {label}
      </SubmitButton>
    </form>
  );
}

export default async function SammlerPage({ searchParams }: PageProps<"/sammler">) {
  const params = await searchParams;
  const notice = typeof params.hinweis === "string" ? params.hinweis.slice(0, 300) : null;
  const { supabase } = await requireOwner();
  const meta = getMetaEnv() !== null;
  const ph = getProductHuntEnv() !== null;
  const cj = getCjEnv() !== null;
  const ae = getAliExpressEnv() !== null;
  const ai = getAnthropicEnv() !== null;

  const [termsRes, feedsRes, runsRes] = await Promise.all([
    supabase.from("ad_watch_terms").select("id, term, country, active, last_run_at, last_count, last_error, items(name)").order("term"),
    supabase.from("feeds").select("id, url, name, area, keywords, last_run_at, last_count, last_error").order("name"),
    supabase.from("research_runs").select("id, job, started_at, status, new_items, log").order("started_at", { ascending: false }).limit(15),
  ]);
  const terms = (termsRes.data ?? []) as unknown as Term[];
  const feeds = (feedsRes.data ?? []) as Feed[];
  const runs = (runsRes.data ?? []) as Run[];
  const migrationMissing = Boolean(termsRes.error || feedsRes.error);

  return (
    <>
      <PageHeader
        title="Datensammler"
        description="Bots, die jeden Tag automatisch aus offiziellen, kostenlosen Quellen sammeln. Jeder Eintrag behält seine Originalquelle und das Entdeckungsdatum; Duplikate werden zusammengeführt."
      />

      {notice ? (
        <Card className="mb-6 border-accent/40">
          <p className="px-5 py-3 text-sm">{notice}</p>
        </Card>
      ) : null}
      {migrationMissing ? (
        <Card className="mb-6 border-warning/40">
          <p className="px-5 py-3 text-sm text-warning">Die Tabellen fehlen noch. Bitte die Migration 0004_collectors.sql in Supabase ausführen.</p>
        </Card>
      ) : null}

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Anzeigen-Stichwörter (Meta Ad Library)"
            description="Jeden Tag um ca. 04:00 werden für jedes Stichwort bis zu 300 aktive Anzeigen im gewählten Land abgefragt. Daraus entsteht die eigene Rangliste im Ad Spy („meiste aktive Anzeigen jetzt“). Kostenlos, aber Meta begrenzt die Abfragen pro Stunde: ca. 20–30 Stichwörter pro Tag sind realistisch."
            action={<RunButton job="ads" disabled={!meta || !terms.length} label="Jetzt sammeln" reason={!meta ? "META_ACCESS_TOKEN fehlt" : "Zuerst ein Stichwort hinzufügen"} />}
          />
          <form action={addWatchTerm} className="flex flex-wrap items-end gap-3 border-t border-border p-5">
            <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Stichwort</span>
              <input name="begriff" required maxLength={100} className={inputClass} placeholder="z. B. led maske, hundebett, posture corrector" />
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
            <SubmitButton>Hinzufügen</SubmitButton>
          </form>
          {!meta ? <p className="border-t border-border px-5 py-3 text-xs text-warning">META_ACCESS_TOKEN fehlt: Stichwörter werden gespeichert, aber erst gesammelt, wenn die Meta-API verbunden ist.</p> : null}
          {terms.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {terms.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium">{t.term}</span> <Badge>{t.country}</Badge>
                    {t.items ? <Badge tone="accent" className="ml-1">Produkt: {t.items.name}</Badge> : null}
                    {!t.active ? <Badge tone="warning" className="ml-1">pausiert</Badge> : null}
                    <p className="mt-1 text-xs text-muted">
                      Zuletzt: {when(t.last_run_at)}
                      {t.last_count !== null ? ` · ${t.last_count} aktive Anzeigen gesehen` : ""}
                    </p>
                    {t.last_error ? <p className="mt-1 text-xs text-warning">{t.last_error}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleWatchTerm}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="aktiv" value={t.active ? "0" : "1"} />
                      <SubmitButton variant="ghost">{t.active ? "Pausieren" : "Aktivieren"}</SubmitButton>
                    </form>
                    <form action={removeWatchTerm}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton variant="ghost" title={`${t.term} entfernen`}>
                        <Trash2 className="size-4" />
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Tag} title="Noch keine Stichwörter">
              Tipp: Produktnamen und Nischenbegriffe in der Sprache des Landes eintragen (z. B. „nackenmassagegerät“ für DE).
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Produkt-Bibliothek (CJdropshipping, AliExpress)"
            description="Jeden Tag um ca. 03:30: CJ-Trend- und Neuheitenliste plus deine Suchbegriffe von der Seite „Produkte“ bei jeder verbundenen Plattform, sortiert nach Beliebtheit. Steine, Rohstoffe, Ersatz- und Elektronikteile werden per Regel ausgeblendet."
            action={<RunButton job="library" disabled={!cj && !ae} label="Jetzt sammeln" reason="Keine Plattform verbunden" />}
          />
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            {cj ? "CJdropshipping verbunden (Tageslimit CJ_DAILY_LIMIT, Standard 300). " : "CJdropshipping nicht verbunden: CJ_API_KEY fehlt. "}
            {ae ? "AliExpress verbunden (Tageslimit ALIEXPRESS_DAILY_LIMIT, Standard 300)." : "AliExpress nicht verbunden: Schlüssel nach Freigabe in Vercel eintragen (Anleitung in den Projektdateien)."}
          </p>
        </Card>

        <Card>
          <CardHeader
            title="KI-Bewertung (Claude Haiku)"
            description="Jeden Tag um ca. 06:30: bewertet neue Bibliotheks-Produkte (relevant ja/nein, Note 1–5, kurze Begründung). Wird als Einschätzung markiert, nie als Fakt. Stoppt beim Tagesbudget (AI_MONTHLY_BUDGET_USD / 30)."
            action={<RunButton job="ai" disabled={!ai} label="Jetzt bewerten" reason="ANTHROPIC_API_KEY fehlt" />}
          />
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            {ai ? "Verbunden. Kosten stehen auf der Seite „Produkte“ unter „Tägliches Update“." : "Aus: ANTHROPIC_API_KEY fehlt. Alles andere funktioniert ohne KI."}
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Neue Shops aus Anzeigen"
            description="Jeden Tag um ca. 04:40, nach dem Anzeigen-Lauf: Werbetreibende, deren älteste bekannte Anzeige höchstens 60 Tage alt ist, die höchstens 15 Anzeigen haben und auf eine eigene Shop-Domain verlinken. Branchen wie Öl, Finanzen oder B2B-Software werden ausgefiltert. Landet im Startup Spy als „Small Business“. Kostet keine API-Abfrage."
            action={<RunButton job="startups" label="Jetzt auswerten" />}
          />
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            Grenze: „bekannt“ heisst in deinen gesammelten Anzeigen. Hat ein Shop früher schon geworben und diese Anzeigen wurden nie gesammelt, wirkt er neuer, als er ist. Je mehr Stichwörter oben, desto mehr Treffer.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Product Hunt"
            description="Jeden Tag um ca. 05:00: neue Launches der letzten 36 Stunden. Gespeichert werden nur Launches mit Konsum-Themen (z. B. Hardware, Fashion, Home, Beauty, Pets) und ohne klares Software-Thema. Product Hunt ist überwiegend Software, deshalb kommen hier eher wenige Treffer. Landet im Startup Spy."
            action={<RunButton job="producthunt" disabled={!ph} label="Jetzt sammeln" reason="PRODUCTHUNT_TOKEN fehlt" />}
          />
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            {ph
              ? "Verbunden. Die API ist kostenlos, aber laut Product Hunt nur für nicht kommerzielle Nutzung; eine private Recherche-Seite passt dazu."
              : "Noch nicht verbunden: PRODUCTHUNT_TOKEN in Vercel eintragen (siehe README „Datensammler“)."}
          </p>
        </Card>

        <Card>
          <CardHeader
            title="RSS-Feeds"
            description="Jeden Tag um ca. 05:30 werden alle Feeds gelesen. Mit Stichwörtern werden nur passende Einträge gespeichert. Nur Feeds eintragen, die zum Abonnieren gedacht sind (RSS/Atom-Link auf der Website)."
            action={<RunButton job="rss" disabled={!feeds.length} label="Jetzt lesen" reason="Zuerst einen Feed hinzufügen" />}
          />
          <form action={addFeed} className="grid gap-3 border-t border-border p-5 md:grid-cols-[2fr_1fr_1fr]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Feed-Adresse (https)</span>
              <input name="url" type="url" required maxLength={1000} className={inputClass} placeholder="https://…/feed" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input name="name" maxLength={100} className={inputClass} placeholder="optional" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Bereich</span>
              <select name="bereich" defaultValue="future_radar" className={inputClass}>
                {Object.entries(AREA_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="font-medium">Nur Einträge mit diesen Wörtern (Komma-getrennt, leer = alle)</span>
              <input name="stichwoerter" maxLength={2000} className={inputClass} placeholder="z. B. launch, dtc, gadget, kickstarter" />
            </label>
            <div className="flex items-end">
              <SubmitButton>Feed hinzufügen</SubmitButton>
            </div>
          </form>
          {feeds.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {feeds.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{f.name}</span> <Badge>{AREA_LABEL[f.area] ?? f.area}</Badge>
                    <p className="truncate text-xs text-muted">{f.url}</p>
                    <p className="text-xs text-muted">
                      {f.keywords.length ? `Filter: ${f.keywords.join(", ")} · ` : ""}Zuletzt: {when(f.last_run_at)}
                      {f.last_count !== null ? ` · ${f.last_count} passende Einträge` : ""}
                    </p>
                    {f.last_error ? <p className="text-xs text-warning">{f.last_error}</p> : null}
                  </div>
                  <form action={removeFeed}>
                    <input type="hidden" name="id" value={f.id} />
                    <SubmitButton variant="ghost" title={`${f.name} entfernen`}>
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Rss} title="Noch keine Feeds">
              Viele Shop-Blogs und Produkt-News-Seiten haben einen RSS-Link (oft /feed oder /rss). Damit verfolgst du neue Produkte ohne Scraping.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader title="Letzte Läufe" description="Protokoll der automatischen und manuellen Läufe." />
          {runs.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium">{JOB_LABEL[r.job ?? ""] ?? "Recherche"}</span>{" "}
                    <Badge tone={r.status === "success" ? "positive" : r.status === "failed" ? "warning" : "neutral"}>
                      {r.status === "success" ? "ok" : r.status === "failed" ? "Fehler" : r.status === "partial" ? "teilweise" : "läuft"}
                    </Badge>
                    {r.log?.message ? <p className="mt-1 text-xs text-muted">{r.log.message}</p> : null}
                  </div>
                  <span className="text-xs text-muted">{when(r.started_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Bot} title="Noch keine Läufe">
              Sobald die täglichen Läufe eingerichtet sind (README „Datensammler“), erscheinen sie hier.
            </EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
