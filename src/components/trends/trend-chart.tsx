"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/trends/dataforseo";

/** Gut unterscheidbare Linienfarben, in hellem und dunklem Modus lesbar. */
const COLORS = ["#0f9f8f", "#6366f1", "#e11d48", "#d97706", "#0284c7"];

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
};

export function TrendChart({ keywords, points }: { keywords: string[]; points: TrendPoint[] }) {
  const data = points.map((p) => {
    const row: Record<string, string | number | null> = { date: p.dateFrom };
    keywords.forEach((k, i) => (row[k] = p.values[i] ?? null));
    return row;
  });

  return (
    <div className="h-80 w-full" role="img" aria-label={`Suchinteresse für ${keywords.join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "var(--muted)", fontSize: 12 }} minTickGap={32} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <Tooltip
            labelFormatter={(v) => `ab ${fmtDate(String(v))}`}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {keywords.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
