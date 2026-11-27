import { cookies } from "next/headers";
import { CommandPalette } from "@/components/layout/command-palette";
import { MobileHeader, Sidebar, type NavBadges } from "@/components/layout/sidebar";
import { Notice } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth";
import { SIDEBAR_COOKIE } from "@/lib/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, email } = await requireOwner();
  // Ohne Eintrag in app_owner blockiert Row Level Security alle Daten. Klar sagen statt leere Seiten zu zeigen.
  const [{ data: isOwner, error }, inbox, cookieStore] = await Promise.all([
    supabase.rpc("is_owner"),
    // Ungelesene Inbox-Einträge als Zähler in der Navigation. Fehlt die Tabelle (Migration 0006), bleibt der Zähler einfach weg.
    supabase.from("inbox_entries").select("id", { count: "exact", head: true }).is("read_at", null),
    cookies(),
  ]);
  const badges: NavBadges = { "/inbox": inbox.error ? 0 : (inbox.count ?? 0) };
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-dvh">
      <Sidebar email={email} badges={badges} defaultCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader email={email} badges={badges} />
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {!error && isOwner === false ? (
            <Notice>
              Dein Login ist in der Datenbank noch nicht als Besitzer eingetragen, darum bleiben alle Daten leer und Speichern wird blockiert. In Supabase im SQL
              Editor ausführen: <code>insert into app_owner (user_id) select id from auth.users where lower(email) = lower(&apos;deine@adresse.ch&apos;);</code>
            </Notice>
          ) : null}
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
