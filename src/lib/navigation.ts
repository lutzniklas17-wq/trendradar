import {
  Bookmark,
  Bot,
  Calculator,
  Flame,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Radar,
  Rocket,
  Search,
  Store,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; description: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, description: "Neue Entdeckungen auf einen Blick" },
  { href: "/suche", label: "Suche", icon: Search, description: "Alles zu einem Begriff aus allen Bereichen" },
  { href: "/trend-spy", label: "Trend Spy", icon: Flame, description: "Was gerade an Aufmerksamkeit gewinnt" },
  { href: "/ad-spy", label: "Ad Spy", icon: Megaphone, description: "Anzeigen aus offiziellen Werbebibliotheken" },
  { href: "/shop-spy", label: "Shop Spy", icon: Store, description: "Aktive Anzeigen pro Shop und Verlauf" },
  { href: "/google-trends", label: "Google Trends", icon: LineChart, description: "Suchinteresse, Regionen, steigende Suchanfragen" },
  { href: "/startup-spy", label: "Startup Spy", icon: Rocket, description: "Neue Marken, Start-ups und Produktlaunches" },
  { href: "/future-radar", label: "Future Radar", icon: Radar, description: "Produkte mit möglichem Zukunftspotenzial" },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark, description: "Gespeicherte Produkte, Marken und Trends" },
  { href: "/sammler", label: "Datensammler", icon: Bot, description: "Tägliche Bots, Stichwörter und Feeds" },
  { href: "/rechner", label: "Profit-Rechner", icon: Calculator, description: "Gewinn und Szenarien kalkulieren" },
];
