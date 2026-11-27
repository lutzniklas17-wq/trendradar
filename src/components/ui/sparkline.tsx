import { sparklinePoints } from "@/lib/sparkline";

/** Kleine Verlaufslinie ohne Achsen. Farbe als Token, z. B. "var(--chart-1)". */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "var(--chart-1)",
  label,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  label: string;
  className?: string;
}) {
  if (values.length < 2) return <span className="text-[12px] text-subtle">noch kein Verlauf</span>;
  const points = sparklinePoints(values, width, height, 2);
  const last = points.split(" ").at(-1)?.split(",").map(Number);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {last && last.length === 2 ? <circle cx={last[0]} cy={last[1]} r="2" fill={color} /> : null}
    </svg>
  );
}
