/**
 * Regel-Filter für die Produkt-Bibliothek: blendet aus, womit ein Online-Shop nichts anfangen kann
 * (Rohstoffe, Steine, Ersatz- und Elektronikteile, Grosshandelsware). Ohne KI, nachvollziehbar per Begründung.
 * Die Regeln können nur ausschliessen oder „unklar“ melden, nie ein Produkt als gut bestätigen.
 */

export type Relevance = "relevant" | "unclear" | "irrelevant";
export type RelevanceResult = { relevance: Relevance; reason: string | null };

type Rule = { label: string; words: string[] };

/** Sicher kein Endkundenprodukt für einen Shop. */
const EXCLUDE: Rule[] = [
  { label: "Rohstoff oder Steine", words: ["raw material", "raw stone", "rough stone", "gravel", "pebble", "pebbles", "ore", "rock sample", "granules", "pellets", "resin raw", "bulk stone", "stones", "stone"] },
  { label: "Ersatzteil", words: ["spare part", "spare parts", "replacement part", "replacement parts", "repair part", "repair parts", "oem part", "accessory part", "parts for"] },
  { label: "Elektronikbauteil", words: ["resistor", "capacitor", "transistor", "diode", "pcb", "circuit board", "development board", "ic chip", "integrated circuit", "relay module", "sensor module", "connector terminal", "wire harness", "crimp terminal"] },
  { label: "Industrie oder Werkstattbedarf", words: ["bearing", "bearings", "gasket", "o-ring", "hydraulic", "pneumatic", "industrial", "cnc", "welding", "solenoid valve", "screw", "screws", "bolt", "bolts", "rivet", "rivets"] },
  { label: "Grosshandel oder Verpackungsmaterial", words: ["wholesale lot", "bulk lot", "packaging bag", "shipping bag", "carton box", "label sticker roll", "blank label"] },
];

/** Kategorien, die fast nur Teile oder Material enthalten. */
const EXCLUDE_CATEGORIES = ["electronic components", "spare parts", "auto parts", "motorcycle parts", "industrial", "raw materials", "machinery", "hardware fasteners"];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Ganze Wörter/Phrasen finden („ore“ nicht in „store“, „stone“ nicht in „rhinestone“). */
function hasPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]+");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

/** Wörter, bei denen „stone“ zu Schmuck oder Deko gehört und kein Rohstoff ist. */
const STONE_OK = ["jewelry", "jewellery", "necklace", "bracelet", "ring", "earring", "earrings", "pendant", "lamp", "decor", "decoration", "massage", "gua sha", "roller", "diffuser", "pizza", "baking", "coaster", "coasters"];

export function classifyProduct(p: { title: string; categoryPath?: string | null; price?: number | null; imageUrl?: string | null }): RelevanceResult {
  const title = norm(p.title);
  const category = norm(p.categoryPath ?? "");

  for (const c of EXCLUDE_CATEGORIES) if (category.includes(c)) return { relevance: "irrelevant", reason: `Kategorie „${p.categoryPath}“ (Teile/Material)` };

  for (const rule of EXCLUDE) {
    const hit = rule.words.find((w) => hasPhrase(title, w));
    if (!hit) continue;
    if ((hit === "stone" || hit === "stones") && STONE_OK.some((w) => hasPhrase(title, w) || category.includes(w))) continue;
    return { relevance: "irrelevant", reason: `${rule.label} („${hit}“)` };
  }

  if (!p.imageUrl) return { relevance: "unclear", reason: "Kein Produktbild" };
  if (p.price !== null && p.price !== undefined && p.price < 0.5) return { relevance: "unclear", reason: "Einkaufspreis unter 0.50 USD (oft Kleinteil)" };
  return { relevance: "relevant", reason: null };
}
