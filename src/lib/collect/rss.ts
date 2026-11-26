import type { Discovery, ItemArea } from "@/lib/collect/discoveries";

export const RSS_SOURCE_ID = "rss";
export const MAX_FEED_BYTES = 2_000_000;
export const MAX_ENTRIES_PER_FEED = 50;

export type FeedEntry = { title: string; link: string; publishedAt: string | null; summary: string | null; image?: string | null };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Entfernt CDATA, HTML-Tags und wandelt die häufigsten Entities um. */
export function cleanText(raw: string | null | undefined) {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/<[^>]*>/g, " ") // HTML, das als Entities kodiert war
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
};

/** Link eines Atom-Eintrags: bevorzugt rel="alternate" oder ohne rel. */
const atomLink = (block: string) => {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  const pick = links.find((a) => !/rel=/i.test(a) || /rel=["']alternate["']/i.test(a)) ?? links[0];
  return pick?.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
};

const isoDate = (raw: string | null) => {
  const t = raw ? Date.parse(cleanText(raw)) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const httpUrl = (raw: string | null) => {
  const v = cleanText(raw);
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

const attr = (tagText: string, name: string) => tagText.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] ?? null;

const httpsImage = (raw: string | null) => {
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/&amp;/g, "&"));
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Bild eines Eintrags, nur aus dem Feed selbst (keine Artikelseiten abrufen):
 * media:content/media:thumbnail, enclosure mit Bildtyp oder das erste <img> in der Beschreibung.
 */
export function extractImage(block: string): string | null {
  for (const m of block.matchAll(/<media:(?:content|thumbnail)\b[^>]*>/gi)) {
    const medium = attr(m[0], "medium");
    const type = attr(m[0], "type");
    if (medium && medium !== "image") continue;
    if (type && !type.startsWith("image/")) continue;
    const url = httpsImage(attr(m[0], "url"));
    if (url) return url;
  }
  for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
    if (!/^image\//i.test(attr(m[0], "type") ?? "")) continue;
    const url = httpsImage(attr(m[0], "url"));
    if (url) return url;
  }
  const decoded = block.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const img = decoded.match(/<img\b[^>]*>/i)?.[0];
  return img ? httpsImage(attr(img, "src")) : null;
}

/** Liest RSS 2.0 (<item>) und Atom (<entry>). Einträge ohne Titel oder gültigen Link werden übersprungen. */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const entries: FeedEntry[] = [];
  for (const [, kind, block] of blocks) {
    const title = cleanText(tag(block, "title"));
    const link = kind.toLowerCase() === "entry" ? httpUrl(atomLink(block)) : httpUrl(tag(block, "link") ?? tag(block, "guid"));
    if (!title || !link) continue;
    const summary = cleanText(tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content")) || null;
    const publishedAt = isoDate(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date"));
    entries.push({ title: title.slice(0, 300), link, publishedAt, summary: summary ? summary.slice(0, 1000) : null, image: extractImage(block) });
    if (entries.length >= MAX_ENTRIES_PER_FEED) break;
  }
  return entries;
}

/** Ohne Stichwörter passt jeder Eintrag, sonst muss eines im Titel oder in der Zusammenfassung vorkommen. */
export function matchesKeywords(entry: FeedEntry, keywords: string[]) {
  const words = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return true;
  const text = `${entry.title} ${entry.summary ?? ""}`.toLowerCase();
  return words.some((w) => text.includes(w));
}

/** Stichwörter aus einem Eingabefeld (Komma oder Zeilenumbruch getrennt). */
export function parseKeywords(raw: string) {
  return [...new Set(raw.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2 && k.length <= 60))].slice(0, 30);
}

export function toDiscovery(entry: FeedEntry, feed: { name: string; area: ItemArea }): Discovery {
  return {
    name: entry.title,
    type: "topic",
    area: feed.area,
    sourceId: RSS_SOURCE_ID,
    sourceUrl: entry.link,
    description: entry.summary,
    category: feed.name,
  };
}

/** Lädt einen Feed mit Zeit- und Grössenlimit. */
export async function fetchFeed(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": "TrendRadar-Feedreader/1.0 (privat)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Feed antwortet mit HTTP ${res.status}.`);
  const text = await res.text();
  if (text.length > MAX_FEED_BYTES) throw new Error("Feed ist zu gross.");
  if (!/<(rss|feed|rdf:RDF)\b/i.test(text)) throw new Error("Kein RSS- oder Atom-Feed.");
  return text;
}
