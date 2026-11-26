import Link from "next/link";
import { Radar, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { SubmitButton } from "@/components/ui/submit-button";
import { addRadarTopic, removeRadarTopic } from "@/app/(app)/future-radar/actions";
import { requireOwner } from "@/lib/auth";
import { hasRadarFilters, filterTopics, parseRadarFilters, RADAR_OUTLOOKS, RADAR_SORTS, resultLabel } from "@/lib/list-filters";
import { assessTopic, changeLabel, OUTLOOK_LABEL, type Outlook, type TopicStats } from "@/lib/radar/assess";

const PATH = "/future-radar";

/** Filter der Feed-Liste auf derselben Seite bleiben erhalten, wenn hier gefiltert wird. */
const keepItemParams = (params: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(
    ["filter", "kategorie", "zeitraum", "sortierung"].flatMap((k) => (typeof params[k] === "string" && params[k] ? [[k, params[k] as string]] : [])),
  );

const OUTLOOK_TONE: Record<Outlook, "accent" | "positive" | "negative" | "neutral"> = {
  emerging: "accent",
  rising: "positive",
  stable: "neutral",
  falling: "negative",
  too_little: "neutral",
};

function Fact({ label, value, source }: { label: string; value: number | string; source: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]" title={`Quelle: ${source}`}>
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Beobachtete Themen mit getrennten Spalten: Fakten (gezählt), Signal (Veränderung), Einschätzung (Regel). */
export async function RadarTopics({ params }: { params: Record<string, string | string[] | undefined> }) {
  const filters = parseRadarFilters(params);
  const { supabase } = await requireOwner();
  const { data, error } = await supabase.rpc("radar_topic_stats");
  const now = new Date();
  const all = ((data ?? []) as TopicStats[]).map((s) => {
    const a = assessTopic(s, now);
    return { ...s, ...a };
  });
  const topics = filterTopics(all, filters);

  return (
    <Card>
      <CardHeader
        title="Beobachtete Themen"
        description="Zahlen aus deinen gesammelten Daten: Daily News, Anzeigen-Stichwörter mit gleichem Begriff und Einträge aller Bereiche. Die Einschätzung folgt festen Regeln (keine KI) und ist keine Prognose."
      />
      <form action={addRadarTopic} className="grid gap-3 border-b border-border p-5 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <Field label="Thema">
          <Input name="thema" required minLength={2} maxLength={60} placeholder="z. B. Pilzkaffee" />
        </Field>
        <Field label="Notiz (optional)">
          <Input name="notiz" maxLength={300} placeholder="Warum beobachten?" />
        </Field>
        <SubmitButton pendingLabel="Speichert…">Beobachten</SubmitButton>
      </form>
      {all.length ? (
        <FilterBar
          path={PATH}
          query={null}
          keep={keepItemParams(params)}
          active={hasRadarFilters(filters)}
          resultLabel={resultLabel(topics.length, all.length, ["Thema", "Themen"])}
          controls={[
            { kind: "select", name: "einschaetzung", label: "Einschätzung", value: filters.outlook, options: RADAR_OUTLOOKS },
            { kind: "select", name: "reihenfolge", label: "Sortierung", value: filters.sort, options: RADAR_SORTS },
          ]}
        />
      ) : null}
      {error ? (
        <EmptyState icon={Radar} title="Datenbank nicht bereit">
          Ist die Migration 0007 ausgeführt? Siehe README „Future Radar“.
        </EmptyState>
      ) : topics.length ? (
        <ul className="divide-y divide-border">
          {topics.map((t) => (
            <li key={t.topic_id} className="px-5 py-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.term}</p>
                  {t.note ? <p className="mt-0.5 truncate text-[13px] text-muted">{t.note}</p> : null}
                </div>
                <form action={removeRadarTopic}>
                  <input type="hidden" name="id" value={t.topic_id} />
                  <SubmitButton variant="ghost" size="sm" title={`${t.term} nicht mehr beobachten`}>
                    <Trash2 className="size-4" aria-hidden />
                  </SubmitButton>
                </form>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-subtle">Fakten</p>
                  <Fact label="News, 7 Tage" value={t.news_7d} source="Daily News (deine Feeds)" />
                  <Fact label="News, Vorwoche" value={t.news_prev_7d} source="Daily News (deine Feeds)" />
                  {t.has_ad_term ? (
                    <>
                      <Fact label="Aktive Anzeigen (gestern/heute)" value={t.ads_active} source="Meta Ad Library, Anzeigen-Stichwort" />
                      <Fact label="Neue Anzeigen, 7 Tage" value={t.ads_new_7d} source="Meta Ad Library, Startdatum der Anzeige" />
                    </>
                  ) : (
                    <p className="text-xs text-subtle">
                      Keine Anzeigen-Daten:{" "}
                      <Link href="/sammler" className="text-accent hover:underline">
                        gleiches Stichwort im Datensammler
                      </Link>{" "}
                      eintragen.
                    </p>
                  )}
                  <Fact label="Neue Einträge, 30 Tage" value={t.items_30d} source="Trend Spy, Startup Spy, Future Radar" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-subtle">Signal</p>
                  <p className="text-sm tabular-nums">{changeLabel(t.current, t.previous)}</p>
                  <p className="text-[13px] text-muted tabular-nums">
                    {t.current} Treffer diese Woche, {t.previous} in der Vorwoche (News und neue Anzeigen)
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-subtle">Einschätzung (Regel, keine KI)</p>
                  <Badge tone={OUTLOOK_TONE[t.outlook]}>{OUTLOOK_LABEL[t.outlook]}</Badge>
                  <p className="text-[13px] text-muted">{t.reason}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : all.length ? (
        <EmptyState icon={Radar} title="Keine Einträge für diese Filter">
          <Link href={PATH} className="text-accent hover:underline">
            Filter zurücksetzen
          </Link>
        </EmptyState>
      ) : (
        <EmptyState icon={Radar} title="Noch keine Themen">
          Trage oben ein Thema ein. Gezählt wird in deinen Daily News, Anzeigen und Einträgen; es gibt keine Beispieldaten.
        </EmptyState>
      )}
    </Card>
  );
}
