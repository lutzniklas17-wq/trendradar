import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const numberFormatters = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, digits = 2) {
  const key = String(digits);
  let f = numberFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    numberFormatters.set(key, f);
  }
  // -0 nicht als "-0.00" anzeigen
  return f.format(Object.is(value, -0) || Math.abs(value) < 0.5 / 10 ** digits ? 0 : value);
}

const dateFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

export function formatDate(value: string | Date, withTime = false) {
  const d = typeof value === "string" ? new Date(value) : value;
  return (withTime ? dateTimeFormatter : dateFormatter).format(d);
}

/** Nur den Hostnamen eines Links zeigen, z. B. für Quellenangaben. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
