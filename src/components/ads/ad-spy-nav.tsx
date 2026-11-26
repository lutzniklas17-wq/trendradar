import Link from "next/link";
import { cn } from "@/lib/utils";

/** Umschalter: Meta (Live-Suche, Rangliste aus eigenen Daten) und TikTok. */
export function AdSpyNav({ active }: { active: "suche" | "rangliste" | "tiktok" }) {
  const items = [
    { id: "rangliste", href: "/ad-spy/rangliste", label: "Meta · Anzeigen" },
    { id: "suche", href: "/ad-spy", label: "Meta · Live-Suche" },
    { id: "tiktok", href: "/ad-spy/tiktok", label: "TikTok" },
  ] as const;
  return (
    <nav className="mb-6 flex gap-5 overflow-x-auto border-b border-border text-sm [scrollbar-width:none]" aria-label="Ad Spy Ansicht">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          aria-current={active === i.id ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 pb-2.5 transition-colors duration-150",
            active === i.id ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
