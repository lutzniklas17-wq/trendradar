import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Minus, Pencil, Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOwner } from "@/lib/auth";
import type { Change } from "@/lib/inbox";
import { markAllRead } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

type Entry = { id: string; created_at: string; job: string; title: string; changes: Change[]; read_at: string | null };

const JOBS = [
  { value: "", label: "Alle Updates" },
  { value: "ads", label: "Anzeigen" },
  { value: "shops", label: "Shops" },
  { value: "producthunt", label: "Product Hunt" },
  { value: "rss", label: "RSS-Feeds" },
] as const;
const KINDS = [
  { value: "", label: "Alle Änderungen" },
  { value: "added", label: "Neu" },
  { value: "changed", label: "Geändert" },
  { value: "removed", label: "Entfernt / beendet" },
] as const;

const KIND_STYLE: Record<Change["kind"], { icon: typeof Plus; label: string; className: string }> = {
  added: { icon: Plus, label: "neu", className: "text-positive" },
  changed: { icon: Pencil, label: "geändert", className: "text-accent" },
  removed: { icon: Minus, label: "entfernt", className: "text-negative" },
};

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const params = await searchParams;
  const job = JOBS.some((j) => j.value === params.lauf) ? String(params.lauf) : "";
  const kind = KINDS.some((k) => k.value === params.art) ? String(params.art) : "";
  const onlyFav = params.favoriten === "1";
  const { supabase } = await requireOwner();
  const { data, error } = await supabase.from("inbox_entries").select("id, created_at, job, title, changes, read_at").order("created_at", { ascending: false }).limit(100);
  const all = (data ?? []) as Entry[];
  const unread = all.filter((e) => !e.read_at).length;
  const entries = all
    .filter((e) => !job || e.job === job)
    .map((e) => ({ ...e, changes: e.changes.filter((c) => (!kind || c.kind === kind) && (!onlyFav || c.favorite)) }))
    .filter((e) => e.changes.length);

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Was die täglichen Updates verändert haben: neu, geändert, entfernt. Ein Eintrag entsteht nur, wenn sich wirklich etwas getan hat."
      >
        {unread ? (
          <form action={markAllRead}>
            <SubmitButton variant="secondary">Alle als gelesen markieren</SubmitButton>
          </form>
        ) : null}
      </PageHeader>
      {error ? <Notice>Die Inbox fehlt noch. Bitte die Migration 0006 in Supabase ausführen.</Notice> : null}

      {all.length ? (
        <div className="mb-6">
          <FilterBar
            path="/inbox"
            query={null}
            active={Boolean(job || kind || onlyFav)}
            resultLabel={unread ? `${unread} ungelesen` : "Alles gelesen"}
            controls={[
              { kind: "select", name: "lauf", label: "Update", value: job, options: JOBS },
              { kind: "select", name: "art", label: "Änderung", value: kind, options: KINDS },
              { kind: "toggle", name: "favoriten", label: "Nur Favoriten", checked: onlyFav },
            ]}
          />
        </div>
      ) : null}

      {entries.length ? (
        <div className="space-y-4">
          {entries.map((e) => (
            <Card key={e.id} className={e.read_at ? undefined : "border-accent/40"}>
              <CardHeader
                title={e.title}
                description={new Date(e.created_at).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "full", timeStyle: "short" })}
                action={e.read_at ? null : <Badge tone="accent">neu</Badge>}
              />
              <ul className="divide-y divide-border border-t border-border text-sm">
                {e.changes.map((c, i) => {
                  const k = KIND_STYLE[c.kind] ?? KIND_STYLE.changed;
                  const Icon = k.icon;
                  const label = c.href ? (
                    <Link href={c.href} className="font-medium hover:text-accent">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{c.label}</span>
                  );
                  return (
                    <li key={i} className="flex items-start gap-3 px-5 py-2.5">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${k.className}`} aria-label={k.label} />
                      <div className="min-w-0">
                        <p>
                          {label}
                          {c.favorite ? <Star className="ml-1.5 inline size-3.5 text-accent" aria-label="Favorit" /> : null}
                        </p>
                        {c.detail ? <p className="text-xs text-muted">{c.detail}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Inbox} title={all.length ? "Keine Einträge für diese Filter" : "Noch keine Updates"}>
            {all.length ? (
              <Link href="/inbox" className="text-accent hover:underline">
                Filter zurücksetzen
              </Link>
            ) : (
              "Sobald ein täglicher Lauf etwas Neues findet oder sich ein Shop deutlich verändert, steht es hier. Tage ohne Änderung erzeugen keinen Eintrag."
            )}
          </EmptyState>
        </Card>
      )}
    </>
  );
}
