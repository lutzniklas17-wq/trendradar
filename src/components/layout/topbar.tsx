import Link from "next/link";
import { LogOut, Radar, Search } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
      <Link href="/" className="flex items-center gap-2 font-semibold lg:hidden">
        <span className="rounded-lg bg-accent p-1.5 text-white dark:text-black">
          <Radar className="size-4" aria-hidden />
        </span>
        <span className="hidden sm:inline">TrendRadar</span>
      </Link>
      <form action="/suche" className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          type="search"
          placeholder="Produkt, Marke, Kategorie oder Suchbegriff…"
          className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-accent"
          aria-label="Globale Suche"
        />
      </form>
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
          title="Abmelden"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">Abmelden</span>
        </button>
      </form>
    </header>
  );
}
