import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SOURCE_INFO, SOURCE_STATE_LABEL, SOURCE_STATE_TONE, sourceState, type SourceRow } from "@/lib/collect/source-status";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "short", timeStyle: "short" }) : "–";

/** Übersicht: welche Datenquelle läuft, wann zuletzt erfolgreich, und welcher Fehler zuletzt kam. */
export function SourceStatus({ rows, configured, cronReady }: { rows: SourceRow[]; configured: Record<string, boolean>; cronReady: boolean }) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const list = SOURCE_INFO.map((info) => {
    const row = byId.get(info.id) ?? null;
    const isConfigured = configured[info.id] ?? true;
    return { info, row, state: sourceState(row, isConfigured, now) };
  });
  const running = list.filter((l) => l.state === "ok").length;

  return (
    <Card>
      <CardHeader
        title="Datenquellen"
        description={`${running} von ${list.length} Quellen haben in den letzten 48 Stunden erfolgreich geliefert. Fehlt eine Quelle, laufen die anderen trotzdem weiter.`}
      />
      {!cronReady ? (
        <p className="border-t border-border px-5 py-3 text-[13px] text-warning">
          Der tägliche automatische Lauf ist nicht eingerichtet: CRON_SECRET (mind. 16 Zeichen) oder SUPABASE_SERVICE_ROLE_KEY fehlen in Vercel.
          Ohne sie sammelt TrendRadar nur, wenn du hier auf „Jetzt …“ klickst.
        </p>
      ) : null}
      <ul className="divide-y divide-border border-t border-border">
        {list.map(({ info, row, state }) => (
          <li key={info.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{info.label}</span>
                <Badge tone={SOURCE_STATE_TONE[state]}>{SOURCE_STATE_LABEL[state]}</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                {state === "off" ? info.missing : `Liefert: ${info.feeds}`}
              </p>
              {state === "error" && row?.last_error ? <p className="mt-0.5 text-[13px] text-negative">{row.last_error}</p> : null}
            </div>
            <p className="text-[13px] text-muted tabular-nums sm:text-right">
              Zuletzt erfolgreich: {when(row?.last_success_at ?? null)}
              {state === "error" ? <><br />Fehler: {when(row?.last_error_at ?? null)}</> : null}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
