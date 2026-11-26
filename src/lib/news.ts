/**
 * Vorschläge für News-Feeds. Google News stellt Suchergebnisse als RSS bereit (Format
 * news.google.com/rss/search?q=…&hl=…&gl=…&ceid=…), gedacht zum Abonnieren in Feedreadern.
 * Die Links führen zum Originalartikel beim Verlag. Bilder liefert dieser Feed meist nicht.
 * Hinweis: Die Adressen sind nach dem bekannten Format gebaut, aber nicht live getestet (kein Netz in der Entwicklungsumgebung).
 */
function googleNews(q: string, lang: "de" | "en") {
  const u = new URL("https://news.google.com/rss/search");
  u.searchParams.set("q", q);
  if (lang === "de") {
    u.searchParams.set("hl", "de");
    u.searchParams.set("gl", "CH");
    u.searchParams.set("ceid", "CH:de");
  } else {
    u.searchParams.set("hl", "en-US");
    u.searchParams.set("gl", "US");
    u.searchParams.set("ceid", "US:en");
  }
  return u.toString();
}

export const NEWS_SUGGESTIONS = [
  { id: "gn-ecom-de", name: "Google News: E-Commerce (DE/CH)", url: googleNews('"E-Commerce" OR Onlineshop when:2d', "de") },
  { id: "gn-gruender-de", name: "Google News: Jungunternehmer und Online-Business", url: googleNews('(Gründer OR Jungunternehmer OR Startup) (Onlineshop OR "Online-Business" OR Marke) when:2d', "de") },
  { id: "gn-umsatz-de", name: "Google News: Marken mit Umsatz-Meilensteinen", url: googleNews('(Marke OR Brand OR Onlineshop) ("Millionen Umsatz" OR "Mio. Umsatz") when:7d', "de") },
  { id: "gn-dtc-en", name: "Google News: DTC brands (EN)", url: googleNews('("DTC brand" OR "direct-to-consumer") when:2d', "en") },
  { id: "gn-shopify-en", name: "Google News: Shopify store success (EN)", url: googleNews('("Shopify store" OR "ecommerce brand") ("million in sales" OR "teen entrepreneur" OR "founder") when:7d', "en") },
] as const;

/** Relative Zeitangabe wie bei News-Portalen („vor 3 Std.“). */
export function timeAgo(iso: string | null, now = new Date()) {
  if (!iso) return "";
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `vor ${Math.max(1, min)} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
}

/** Google-News-Titel enden mit „ - Quelle“. Diese Quelle wird separat angezeigt. */
export function splitSource(title: string): { title: string; source: string | null } {
  const m = title.match(/^(.*\S)\s+[-–]\s+([^-–]{2,60})$/);
  return m ? { title: m[1], source: m[2].trim() } : { title, source: null };
}

type FilterableNews = { title: string; excerpt: string | null; publisher: string; source_name: string; date: string };

/** Filtert News nach Text, Feed und Zeitraum in Tagen (0 = alle). */
export function filterNews<T extends FilterableNews>(list: T[], f: { text: string; source: string; days: number }, now = new Date()): T[] {
  const since = f.days ? now.getTime() - f.days * 86_400_000 : null;
  const needle = f.text.trim().toLowerCase();
  return list.filter(
    (a) =>
      (!needle || `${a.title} ${a.excerpt ?? ""} ${a.publisher}`.toLowerCase().includes(needle)) &&
      (!f.source || a.source_name === f.source) &&
      (since === null || new Date(a.date).getTime() >= since),
  );
}
