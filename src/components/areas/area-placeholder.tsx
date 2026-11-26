import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

/** Ehrlicher Platzhalter: zeigt, welche Quellen geplant sind, statt Beispieldaten zu erfinden. */
export function AreaPlaceholder({
  icon,
  title,
  sources,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  sources: { name: string; note: string }[];
  phase: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <EmptyState icon={icon} title={title}>
          Es werden keine Beispieldaten angezeigt. Echte Ergebnisse erscheinen hier, sobald die Datenquellen angebunden
          sind ({phase}).
        </EmptyState>
      </Card>
      <Card>
        <CardHeader title="Geplante Datenquellen" />
        <ul className="divide-y divide-border">
          {sources.map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted">{s.note}</p>
              </div>
              <Badge>geplant</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
