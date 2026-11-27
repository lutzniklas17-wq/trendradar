import { Lightbulb, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { addRadarTopic } from "@/app/(app)/future-radar/actions";
import { requireOwner } from "@/lib/auth";
import { loadTopicSuggestions } from "@/lib/radar/load-suggestions";

/** Themen, die Future Radar selbst in den eigenen Daten gefunden hat. Ein Klick übernimmt sie in die Beobachtung. */
export async function RadarSuggestions() {
  const { supabase } = await requireOwner();
  const suggestions = await loadTopicSuggestions(supabase);

  return (
    <Card>
      <CardHeader
        title="Gefunden: Themen, die gerade auftauchen"
        description="Automatisch aus deinen Daten: Wörter, die in gesammelten Titeln (Future Radar, Startup Spy) diese Woche deutlich öfter vorkommen, und stark steigende Google-Suchanfragen aus deinen Trends-Abfragen. Signal, keine Bewertung."
        action={<Lightbulb className="size-4 text-muted" aria-hidden />}
      />
      {suggestions.length ? (
        <ul className="grid gap-px bg-border sm:grid-cols-2">
          {suggestions.map((s) => (
            <li key={s.term} className="flex items-center gap-3 bg-surface px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{s.term}</span>
                  <Badge tone={s.source === "trends" ? "positive" : "accent"}>{s.source === "trends" ? "Google Trends" : "Titel"}</Badge>
                </p>
                <p className="mt-0.5 text-[13px] text-muted">{s.reason}</p>
              </div>
              <form action={addRadarTopic}>
                <input type="hidden" name="thema" value={s.term} />
                <input type="hidden" name="notiz" value={`Vorschlag: ${s.reason}`.slice(0, 300)} />
                <SubmitButton variant="secondary" size="sm" pendingLabel="…" title={`„${s.term}“ beobachten`}>
                  <Plus className="size-3.5" aria-hidden /> Beobachten
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-[13px] text-muted">
          Noch keine Vorschläge. Sie entstehen, sobald RSS-Feeds mit Bereich „Future Radar“ Einträge sammeln (Seite Sammler) oder du auf Google Trends
          Begriffe abfragst. Ein Wort braucht mindestens 3 Nennungen in einer Woche und doppelt so viele wie in der Vorwoche.
        </p>
      )}
    </Card>
  );
}
