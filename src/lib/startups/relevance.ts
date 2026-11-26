/**
 * E-Commerce-Relevanz nach festen Regeln (ohne KI). Das Ergebnis ist eine Einschätzung, keine Tatsache,
 * und wird in der Oberfläche so beschriftet. Ziel: Industrie, Öl, Finanzen, B2B-Software usw. fernhalten,
 * Konsumprodukte und Online-Shops durchlassen. Später ergänzt die KI-Einstufung unklare Fälle.
 */
export type Relevance = "ecommerce" | "unclear" | "excluded";
export type RelevanceResult = { relevance: Relevance; reason: string };

/** Branchen, die für Online-Shops und Dropshipping nicht relevant sind. Ganze Wörter oder Wortanfänge. */
const EXCLUDED: [string, string][] = [
  ["erdöl", "Öl und Gas"], ["rohöl", "Öl und Gas"], ["heizöl", "Öl und Gas"], ["mineralöl", "Öl und Gas"],
  ["petroleum", "Öl und Gas"], ["crude oil", "Öl und Gas"], ["oil and gas", "Öl und Gas"], ["oil & gas", "Öl und Gas"],
  ["oilfield", "Öl und Gas"], ["erdgas", "Öl und Gas"], ["raffinerie", "Öl und Gas"], ["refinery", "Öl und Gas"], ["pipeline", "Öl und Gas"],
  ["bergbau", "Bergbau"], ["mining", "Bergbau"], ["rohstoffhandel", "Rohstoffe"], ["commodities", "Rohstoffe"],
  ["maschinenbau", "Industrie"], ["industrieanlage", "Industrie"], ["industrial", "Industrie"], ["manufacturing execution", "Industrie"],
  ["stahl", "Industrie"], ["chemie", "Chemie"], ["chemical", "Chemie"], ["pharma", "Pharma"], ["biotech", "Pharma"], ["clinical trial", "Pharma"],
  ["bank", "Finanzen"], ["banking", "Finanzen"], ["fintech", "Finanzen"], ["versicherung", "Finanzen"], ["insurance", "Finanzen"],
  ["vermögensverwaltung", "Finanzen"], ["asset management", "Finanzen"], ["kredit", "Finanzen"], ["lending", "Finanzen"],
  ["crypto", "Krypto"], ["krypto", "Krypto"], ["blockchain", "Krypto"], ["token sale", "Krypto"], ["web3", "Krypto"],
  ["immobilien", "Immobilien"], ["real estate", "Immobilien"], ["proptech", "Immobilien"],
  ["saas", "B2B-Software"], ["b2b", "B2B"], ["enterprise software", "B2B-Software"], ["developer", "B2B-Software"], ["api", "B2B-Software"],
  ["devops", "B2B-Software"], ["cybersecurity", "B2B-Software"], ["erp", "B2B-Software"], ["crm", "B2B-Software"],
  ["unternehmensberatung", "Beratung"], ["consulting", "Beratung"], ["personalvermittlung", "Personal"], ["recruiting", "Personal"], ["staffing", "Personal"],
  ["rüstung", "Rüstung"], ["defense", "Rüstung"], ["defence", "Rüstung"],
  ["logistikdienst", "Logistik"], ["freight", "Logistik"], ["spedition", "Logistik"],
  ["bauunternehmen", "Bau"], ["construction company", "Bau"], ["solarpark", "Energie"], ["energieversorger", "Energie"], ["utility company", "Energie"],
];

/** Begriffe, die auf Konsumprodukte, Marken oder Online-Shops hindeuten. */
const ECOMMERCE: string[] = [
  "onlineshop", "online-shop", "online shop", "webshop", "e-commerce", "ecommerce", "shopify", "d2c", "dtc", "direct-to-consumer",
  "brand", "brands", "marke", "marken", "label", "labels", "kollektion", "collection", "shop now", "jetzt kaufen", "jetzt bestellen", "gratis versand", "free shipping",
  "fashion", "mode", "apparel", "streetwear", "schmuck", "jewelry", "jewellery", "accessoires", "accessories", "sneaker", "schuhe", "shoes",
  "beauty", "skincare", "hautpflege", "kosmetik", "cosmetics", "haircare", "parfum", "perfume", "makeup",
  "haustier", "hund", "hunde", "katze", "katzen", "pet", "pets", "dog", "cat", "baby", "kinder", "kids", "spielzeug", "toys",
  "küche", "kitchen", "home", "wohnen", "deko", "decor", "möbel", "furniture", "garten", "garden",
  "fitness", "sport", "sports", "yoga", "outdoor", "camping", "gadget", "gadgets", "wearable", "kopfhörer", "headphones",
  "supplement", "nahrungsergänzung", "snack", "snacks", "kaffee", "coffee", "tee", "tea", "getränk", "drink", "drinks",
  "nachhaltig", "sustainable", "handmade", "handgemacht",
];

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Längere Begriffe als Wortanfang („chemie“ trifft „Chemiewerk“, aber nicht „Petrochemie“),
 * kurze (bis 5 Zeichen) nur als ganzes Wort, damit „marke“ nicht „Marketing“ trifft.
 */
const matcher = (term: string) =>
  term.length <= 5 ? new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}($|[^\\p{L}\\p{N}])`, "u") : new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}`, "u");

const EXCLUDED_RX = EXCLUDED.map(([t, label]) => ({ t, label, rx: matcher(t) }));
const ECOMMERCE_RX = ECOMMERCE.map((t) => ({ t, rx: matcher(t) }));

/**
 * Stuft einen Text ein. hasShopDomain = die Quelle verlinkt auf eine eigene Shop-Domain (z. B. Anzeige mit Link),
 * das zählt als Hinweis auf E-Commerce. Ausschluss-Begriffe haben immer Vorrang.
 */
export function classifyRelevance(parts: (string | null | undefined)[], { hasShopDomain = false } = {}): RelevanceResult {
  const text = normalize(parts.filter(Boolean).join(" "));
  const excluded = EXCLUDED_RX.find((e) => e.rx.test(text));
  if (excluded) return { relevance: "excluded", reason: `Branche „${excluded.label}“ (Begriff „${excluded.t}“)` };
  const hit = ECOMMERCE_RX.find((e) => e.rx.test(text));
  if (hit) return { relevance: "ecommerce", reason: `Konsum-Begriff „${hit.t}“` };
  if (hasShopDomain) return { relevance: "ecommerce", reason: "Anzeige verlinkt auf eine eigene Shop-Domain" };
  return { relevance: "unclear", reason: "Keine eindeutigen Begriffe" };
}

export const RELEVANCE_LABEL: Record<Relevance, string> = {
  ecommerce: "E-Commerce",
  unclear: "unklar",
  excluded: "ausgeschlossen",
};
