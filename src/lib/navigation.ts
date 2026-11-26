import {
  Bookmark,
  Bot,
  Calculator,
  Flame,
  Inbox,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Newspaper,
  Radar,
  Rocket,
  Search,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "Entdecken" | "Recherche" | "Werkzeuge";
export type NavItem = { href: string; label: string; icon: LucideIcon; description: string; group: NavGroup; match?: string };

export const NAV_GROUPS: NavGroup[] = ["Entdecken", "Recherche", "Werkzeuge"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Start", icon: LayoutDashboard, description: "Top 10 des Tages und neue Entdeckungen", group: "Entdecken" },
  { href: "/ad-spy/rangliste", match: "/ad-spy", label: "Anzeigen", icon: Megaphone, description: "Anzeigen aus offiziellen Werbebibliotheken", group: "Entdecken" },
  { href: "/produkte", label: "Produkte", icon: ShoppingBag, description: "Top-Hits und Lieferanten-Bibliothek", group: "Entdecken" },
  { href: "/trend-spy", label: "Trend Spy", icon: Flame, description: "Übernommene und selbst erfasste Produkte mit Analyse", group: "Entdecken" },
  { href: "/shop-spy", label: "Shops", icon: Store, description: "Aktive Anzeigen pro Shop und Verlauf", group: "Entdecken" },
  { href: "/startup-spy", label: "Startups", icon: Rocket, description: "Neue Marken, Start-ups und Produktlaunches", group: "Entdecken" },
  { href: "/future-radar", label: "Future Radar", icon: Radar, description: "Produkte mit möglichem Zukunftspotenzial", group: "Entdecken" },
  { href: "/inbox", label: "Inbox", icon: Inbox, description: "Was sich bei den täglichen Updates geändert hat", group: "Recherche" },
  { href: "/news", label: "Daily News", icon: Newspaper, description: "E-Commerce-News aus deinen Feeds", group: "Recherche" },
  { href: "/suche", label: "Suche", icon: Search, description: "Alles zu einem Begriff aus allen Bereichen", group: "Recherche" },
  { href: "/google-trends", label: "Google Trends", icon: LineChart, description: "Suchinteresse, Regionen, steigende Suchanfragen", group: "Recherche" },
  { href: "/watchlist", label: "Favoriten", icon: Bookmark, description: "Gespeicherte Produkte und Shops", group: "Werkzeuge" },
  { href: "/sammler", label: "Datensammler", icon: Bot, description: "Tägliche Bots, Stichwörter und Feeds", group: "Werkzeuge" },
  { href: "/rechner", label: "Profit-Rechner", icon: Calculator, description: "Gewinn und Szenarien kalkulieren", group: "Werkzeuge" },
];

/** Aktiv, wenn der Pfad dem Eintrag oder seinem Bereich (`match`) entspricht. */
export function isNavActive(pathname: string, item: Pick<NavItem, "href" | "match">) {
  const base = item.match ?? item.href;
  return base === "/" ? pathname === "/" : pathname === base || pathname.startsWith(`${base}/`);
}
