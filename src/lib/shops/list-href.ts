import type { ShopFilters } from "@/lib/list-filters";

/** URL der Shop-Liste mit geänderten Filtern (für Schnellfilter-Chips). Standardwerte bleiben weg. */
export function shopListHref(f: ShopFilters, change: Partial<ShopFilters> = {}) {
  const n = { ...f, ...change };
  const p = new URLSearchParams();
  if (n.text) p.set("filter", n.text);
  if (n.signal) p.set("signal", n.signal);
  if (n.sort) p.set("sortierung", n.sort);
  const q = p.toString();
  return q ? `/shop-spy?${q}` : "/shop-spy";
}
