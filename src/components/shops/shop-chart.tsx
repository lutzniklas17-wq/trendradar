"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
};

/** Verlauf der aktiven Anzeigen eines Shops, ein Punkt pro gezähltem Tag (Lücken bleiben Lücken). */
export function ShopChart({ points }: { points: { day: string; activeAds: number }[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Aktive Anzeigen pro Tag">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={fmtDate} tick={{ fill: "var(--muted)", fontSize: 12 }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <Tooltip
            labelFormatter={(v) => fmtDate(String(v))}
            formatter={(v) => [v, "Aktive Anzeigen"]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="activeAds" stroke="#0f9f8f" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
