import Link from "next/link";
import { ArrowRight, Database } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NAV_ITEMS } from "@/lib/navigation";
import { requireOwner } from "@/lib/auth";

type SourceRow = { id: string; name: string; last_success_at: string | null; last_error_at: string | null };

const dateFormat = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });

export default async function DashboardPage() {
  const { supabase } = await requireOwner();
  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, name, last_success_at, last_error_at")
    .order("name");

  const areas = NAV_ITEMS.filter((i) => !["/", "/suche"].includes(i.href));

  return (
    <>
      <PageHeader title="Dashboard" description="Neue Entdeckungen, Trends und Anzeigen auf einen Blick." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <div className="flex items-center justify-between">
              <Icon className="size-5 text-accent" aria-hidden />
              <ArrowRight className="size-4 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Datenquellen" description="Wann jede Quelle zuletzt erfolgreich aktualisiert wurde." />
        {error || !sources?.length ? (
          <EmptyState icon={Database} title="Noch keine Datenquellen eingerichtet">
            {error ? "Die Datenbank ist noch nicht vorbereitet (Migration ausführen, siehe README)." : null}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {(sources as SourceRow[]).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span>{s.name}</span>
                {s.last_success_at ? (
                  <span className="text-muted">{dateFormat.format(new Date(s.last_success_at))}</span>
                ) : (
                  <Badge>noch nie</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
