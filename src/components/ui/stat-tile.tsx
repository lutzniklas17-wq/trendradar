/** Kennzahl-Kachel: Beschriftung, grosse Zahl, optionaler Zusatz. */
export function StatTile({ label, value, hint, title }: { label: string; value: React.ReactNode; hint?: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4 shadow-xs" title={title}>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}
