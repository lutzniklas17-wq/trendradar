/**
 * Leitet Themen aus echten Produktdaten ab (ohne KI): wiederkehrende Wortpaare in Produkttiteln
 * („neck fan“, „pet hair remover“) und häufige Kategorien. Ein Thema entsteht nur, wenn es in
 * mehreren verschiedenen Produkten vorkommt. Das ist ein Signal, keine Prognose.
 */

export type TopicProduct = {
  id: string;
  title: string;
  category: string | null;
  listedCount: number | null;
  imageUrl: string | null;
};

export type TopicCandidate = {
  name: string;
  normalized: string;
  kind: "product" | "niche";
  productIds: string[];
  listedSum: number;
  imageUrl: string | null;
  category: string | null;
};

/** Füllwörter und Werbesprache: trennen Wortgruppen und sind nie Teil eines Themas. */
const STOP = new Set([
  "the", "and", "for", "with", "from", "set", "sets", "pcs", "pc", "piece", "pieces", "new", "hot", "sale", "best", "top",
  "style", "styles", "color", "colors", "colour", "size", "sizes", "high", "quality", "product", "products", "free",
  "shipping", "inch", "inches", "cross", "border", "amazon", "ebay", "wish", "europe", "european", "american", "korean",
  "japanese", "version", "type", "model", "gift", "gifts", "pack", "packs", "pair", "pairs", "one", "two", "three",
  "your", "you", "all", "any", "big", "small", "large", "medium", "black", "white", "red", "blue", "green", "pink",
  "grey", "gray", "yellow", "purple", "brown", "gold", "silver", "more", "multi", "wholesale", "factory", "direct",
  "spring", "summer", "autumn", "winter", "year", "years", "day", "days", "home", "use", "used", "using",
]);

/** Eigenschaftswörter: dürfen vorne stehen („portable fan“), aber nie das letzte Wort eines Themas sein. */
const ATTRIBUTE = new Set([
  "portable", "wireless", "rechargeable", "smart", "mini", "electric", "magnetic", "waterproof", "adjustable",
  "foldable", "folding", "creative", "multifunctional", "multifunction", "automatic", "household", "outdoor", "indoor",
  "cute", "simple", "fashion", "fashionable", "casual", "women", "womens", "men", "mens", "ladies", "kids", "children",
  "usb", "led", "luxury", "vintage", "retro", "trendy", "soft", "thick", "thin", "long", "short", "loose",
  "slim", "warm", "cool", "plus", "sleeve", "sleeves", "solid", "printed", "print", "handheld", "cordless", "digital",
  "stainless", "steel", "plastic", "silicone", "wooden", "leather", "cotton", "universal", "professional", "travel",
  "personalized", "custom", "decorative", "unisex", "baby", "pet", "dog", "cat", "car", "kitchen", "bathroom",
]);

/** Klein, ohne Sonderzeichen, letztes Wort in Einzahl. Dient der Duplikatprüfung („Neck Fans“ = „neck fan“). */
export function normalizeTopic(name: string) {
  const words = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9äöü\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const last = words[words.length - 1];
  words[words.length - 1] = singular(last);
  return words.join(" ");
}

function singular(w: string) {
  if (w.length <= 3 || w.endsWith("ss") || w.endsWith("us") || w.endsWith("is")) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Wörter eines Titels; Füllwörter, Zahlen und sehr kurze Wörter werden zu Trennern (null). */
export function titleTokens(title: string): (string | null)[] {
  return title
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z]+/)
    .map((w) => (w.length < 3 || STOP.has(w) ? null : w));
}

/** Wortpaare und -tripel aus aufeinanderfolgenden Wörtern; das letzte Wort darf kein Eigenschaftswort sein. */
export function titlePhrases(title: string): string[] {
  const tokens = titleTokens(title);
  const out = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    for (const len of [2, 3]) {
      const part = tokens.slice(i, i + len);
      if (part.length < len || part.some((t) => t === null)) continue;
      const words = part as string[];
      if (ATTRIBUTE.has(words[words.length - 1])) continue;
      if (new Set(words).size < words.length) continue;
      out.add(normalizeTopic(words.join(" ")));
    }
  }
  return [...out];
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/**
 * Themen aus einer Produktliste. Ein Wortpaar zählt pro Produkt höchstens einmal.
 * Ein Tripel verdrängt seine Wortpaare, wenn es fast gleich oft vorkommt (genauer ist besser).
 */
export function extractTopics(products: TopicProduct[], { minProducts = 3, max = 30 }: { minProducts?: number; max?: number } = {}): TopicCandidate[] {
  type Acc = { ids: Set<string>; listed: number; image: string | null; categories: Map<string, number> };
  const phrases = new Map<string, Acc>();
  const niches = new Map<string, Acc & { label: string }>();
  const add = (acc: Acc, p: TopicProduct) => {
    if (acc.ids.has(p.id)) return;
    acc.ids.add(p.id);
    acc.listed += Math.max(0, p.listedCount ?? 0);
    if (!acc.image && p.imageUrl) acc.image = p.imageUrl;
    if (p.category) acc.categories.set(p.category, (acc.categories.get(p.category) ?? 0) + 1);
  };
  for (const p of products) {
    for (const ph of titlePhrases(p.title)) {
      const acc = phrases.get(ph) ?? { ids: new Set(), listed: 0, image: null, categories: new Map() };
      add(acc, p);
      phrases.set(ph, acc);
    }
    const cat = p.category?.trim();
    if (cat && cat.length >= 3) {
      const key = normalizeTopic(cat);
      if (key) {
        const acc = niches.get(key) ?? { ids: new Set(), listed: 0, image: null, categories: new Map(), label: cat };
        add(acc, p);
        niches.set(key, acc);
      }
    }
  }

  const frequent = [...phrases].filter(([, a]) => a.ids.size >= minProducts);
  // Wortpaare entfernen, die in einem fast gleich häufigen Tripel stecken.
  const triples = frequent.filter(([k]) => k.split(" ").length === 3);
  const keep = frequent.filter(([k, a]) => {
    if (k.split(" ").length === 3) return true;
    return !triples.some(([t, ta]) => t.includes(k) && ta.ids.size >= a.ids.size * 0.8);
  });

  const topCategory = (a: Acc) => [...a.categories].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  const out: TopicCandidate[] = [
    ...keep.map(([k, a]) => ({
      name: titleCase(k),
      normalized: k,
      kind: "product" as const,
      productIds: [...a.ids],
      listedSum: a.listed,
      imageUrl: a.image,
      category: topCategory(a),
    })),
    ...[...niches]
      .filter(([, a]) => a.ids.size >= minProducts)
      .map(([k, a]) => ({
        name: a.label,
        normalized: k,
        kind: "niche" as const,
        productIds: [...a.ids],
        listedSum: a.listed,
        imageUrl: a.image,
        category: a.label,
      })),
  ];
  // Bei gleichem Namen (Kategorie = Wortpaar) gewinnt das Produkt-Thema.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.productIds.length - a.productIds.length || b.listedSum - a.listedSum || a.normalized.localeCompare(b.normalized))
    .filter((t) => (seen.has(t.normalized) ? false : (seen.add(t.normalized), true)))
    .slice(0, max);
}
