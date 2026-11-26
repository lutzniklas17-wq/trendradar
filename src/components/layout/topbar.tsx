import Form from "next/form";
import { LogOut, Search } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/layout/sidebar";
import { SubmitButton } from "@/components/ui/submit-button";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Logo className="shrink-0 lg:hidden" />
      <Form action="/suche" className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          name="q"
          type="search"
          required
          placeholder="Produkt, Marke oder Kategorie suchen…"
          className="h-8 w-full rounded-md border border-border bg-surface pr-3 pl-8 text-[13px] shadow-xs outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
          aria-label="Globale Suche"
        />
      </Form>
      <form action={signOut} className="ml-auto">
        <SubmitButton variant="ghost" size="sm" title="Abmelden">
          <LogOut className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Abmelden</span>
        </SubmitButton>
      </form>
    </header>
  );
}
