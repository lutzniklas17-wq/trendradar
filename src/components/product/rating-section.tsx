import { Gauge } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { averageScore, CRITERIA, VERDICTS, type Assessment } from "@/lib/assessment";
import { cn, formatNumber } from "@/lib/utils";

function ScoreBar({ score }: { score: number | null }) {
  return (
    <div className="flex items-center gap-1" aria-label={score == null ? "nicht bewertet" : `${score} von 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 w-6 rounded-full",
            score == null ? "bg-surface-muted" : n <= score ? (score >= 4 ? "bg-positive" : score >= 3 ? "bg-warning" : "bg-negative") : "bg-surface-muted",
          )}
        />
      ))}
    </div>
  );
}

export function RatingSection({ assessment }: { assessment: Assessment | null }) {
  if (!assessment) {
    return (
      <Card>
        <EmptyState icon={Gauge} title="Noch keine Bewertung">
          Die Bewertung nach 8 Kriterien entsteht zusammen mit der Analyse. Kriterien ohne ausreichende Daten bleiben
          unbewertet, statt eine Zahl zu erfinden.
        </EmptyState>
      </Card>
    );
  }

  const { average, rated } = averageScore(assessment.scores);
  const verdict = assessment.verdict ? VERDICTS[assessment.verdict] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Bewertung nach 8 Kriterien" description="1 = schwach, 5 = stark. Grundlage je Kriterium angegeben." />
        <ul className="divide-y divide-border">
          {CRITERIA.map((c) => {
            const s = assessment.scores[c.key];
            return (
              <li key={c.key} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[180px_auto_1fr] sm:items-center sm:gap-4">
                <div>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-muted">{c.hint}</p>
                </div>
                <ScoreBar score={s?.score ?? null} />
                <div className="text-muted">
                  {s ? (
                    <>
                      <Badge tone={s.basis === "data" ? "positive" : "warning"} className="mr-2">
                        {s.basis === "data" ? "Daten" : "Einschätzung"}
                      </Badge>
                      {s.score == null ? "Zu wenig Daten. " : null}
                      {s.reason}
                    </>
                  ) : (
                    "Nicht bewertet."
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="h-fit">
        <CardHeader title="Gesamturteil" />
        <div className="space-y-4 p-5 text-sm">
          <div>
            <p className="text-xs text-muted">Durchschnitt</p>
            <p className="text-2xl font-semibold tabular-nums">{average == null ? "–" : `${formatNumber(average, 1)} / 5`}</p>
            <p className="text-xs text-muted">
              {rated} von {CRITERIA.length} Kriterien bewertet
              {average == null ? " (zu wenige für einen Durchschnitt)" : ""}
            </p>
          </div>
          {verdict ? <Badge tone={verdict.tone} className="px-3 py-1 text-sm">{verdict.label}</Badge> : null}
          {assessment.verdictReason ? <p>{assessment.verdictReason}</p> : null}
          <p className="text-xs text-muted">Das Urteil ist eine Einschätzung und keine Garantie für Verkäufe.</p>
        </div>
      </Card>
    </div>
  );
}
