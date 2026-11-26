import Link from "next/link";
import { cn } from "@/lib/utils";

/** Umschalter zwischen Live-Suche bei Meta und der eigenen Rangliste aus gesammelten Daten. */
export function AdSpyNav({ active }: { active: "suche" | "rangliste" }) {
  const items = [
    { id: "suche", href: "/ad-spy", label: "Live-Suche bei Meta" },
    { id: "rangliste", href: "/ad-spy/rangliste", label: "Rangliste (eigene Daten)" },
  ] as const;
  return (
    <nav className="mb-6 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm" aria-label="Ad Spy Ansicht">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          aria-current={active === i.id ? "page" : undefined}
          className={cn("flex-1 rounded-md px-3 py-1.5 text-center font-medium", active === i.id ? "bg-accent text-white" : "text-muted hover:text-foreground")}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
