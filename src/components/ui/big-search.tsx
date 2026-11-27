import { Search } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Grosses Suchfeld der Entdecken-Seiten (h-12, rounded-xl). Nur das Eingabefeld; Formular und Knopf liefert die Seite. */
export function BigSearchInput({ className, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("relative min-w-0 flex-1 sm:min-w-64", className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input type="search" className={cn(inputClass, "h-12 rounded-xl pl-11 text-[15px] shadow-card")} {...props} />
    </label>
  );
}
