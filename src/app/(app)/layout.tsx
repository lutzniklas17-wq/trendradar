import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Notice } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireOwner();
  // Ohne Eintrag in app_owner blockiert Row Level Security alle Daten. Klar sagen statt leere Seiten zu zeigen.
  const { data: isOwner, error } = await supabase.rpc("is_owner");
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {!error && isOwner === false ? (
            <Notice>
              Dein Login ist in der Datenbank noch nicht als Besitzer eingetragen, darum bleiben alle Daten leer und Speichern wird blockiert. In Supabase im SQL
              Editor ausführen: <code>insert into app_owner (user_id) select id from auth.users where lower(email) = lower(&apos;deine@adresse.ch&apos;);</code>
            </Notice>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
