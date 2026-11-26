import { ExternalLink, Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ANALYSIS_SECTIONS, type Assessment, type ClaimKind } from "@/lib/assessment";
import { formatDate, hostOf } from "@/lib/utils";

export const CLAIM_LABEL: Record<ClaimKind, { label: string; tone: "positive" | "accent" | "warning"; title: string }> = {
  fact: { label: "Fakt", tone: "positive", title: "Belegt durch die verlinkte Quelle" },
  signal: { label: "Signal", tone: "accent", title: "Messbarer Hinweis, aber kein Beweis" },
  assessment: { label: "Einschätzung", tone: "warning", title: "Eigene Einschätzung, keine gemessene Tatsache" },
};

export function AnalysisEmpty() {
  return (
    <Card>
      <EmptyState icon={Sparkles} title="Noch keine Analyse">
        Die KI-Analyse wird angebunden, sobald ein Anthropic-API-Key hinterlegt ist. Sie trennt jede Aussage in Fakt (mit
        Quelle), Signal und Einschätzung.
      </EmptyState>
    </Card>
  );
}

export function AnalysisSection({ assessment }: { assessment: Assessment | null }) {
  if (!assessment) return <AnalysisEmpty />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          Erstellt am {formatDate(assessment.createdAt, true)} mit {assessment.model}.
        </span>
        {(Object.keys(CLAIM_LABEL) as ClaimKind[]).map((k) => (
          <Badge key={k} tone={CLAIM_LABEL[k].tone} title={CLAIM_LABEL[k].title}>
            {CLAIM_LABEL[k].label}
          </Badge>
        ))}
      </div>
      {assessment.summary ? (
        <Card className="p-5 text-sm leading-relaxed">
          <Badge tone="warning" className="mb-2">
            Einschätzung
          </Badge>
          <p>{assessment.summary}</p>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {ANALYSIS_SECTIONS.map((section) => {
          const claims = assessment.claims.filter((c) => c.section === section.key);
          return (
            <Card key={section.key}>
              <CardHeader title={section.label} description={section.hint} />
              {claims.length ? (
                <ul className="space-y-3 p-5 text-sm">
                  {claims.map((c, i) => (
                    <li key={i} className="flex gap-3">
                      <Badge tone={CLAIM_LABEL[c.kind].tone} title={CLAIM_LABEL[c.kind].title} className="h-fit shrink-0">
                        {CLAIM_LABEL[c.kind].label}
                      </Badge>
                      <span>
                        {c.text}
                        {c.sourceUrl ? (
                          <a
                            href={c.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="ml-1 inline-flex items-center gap-0.5 text-xs text-accent hover:underline"
                          >
                            {hostOf(c.sourceUrl)} <ExternalLink className="size-3" aria-hidden />
                          </a>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-5 text-sm text-muted">Keine belastbaren Angaben.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
