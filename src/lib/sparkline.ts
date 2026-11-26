/**
 * Punkte für eine kleine Verlaufslinie (SVG polyline) in einer Fläche von `width` × `height`.
 * Leere Liste → "", ein Wert → waagrechte Linie. Die y-Achse beginnt bei 0, damit kleine Schwankungen nicht übertrieben wirken.
 */
export function sparklinePoints(values: number[], width: number, height: number, pad = 1) {
  if (!values.length) return "";
  const series = values.length === 1 ? [values[0], values[0]] : values;
  const max = Math.max(...series, 1);
  const step = (width - pad * 2) / (series.length - 1);
  return series
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - (Math.max(v, 0) / max) * (height - pad * 2);
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}

const round = (n: number) => Math.round(n * 10) / 10;
