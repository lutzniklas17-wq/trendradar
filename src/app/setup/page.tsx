import type { Metadata } from "next";

export const metadata: Metadata = { title: "Einrichtung" };

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-xl font-medium">TrendRadar ist noch nicht eingerichtet</h1>
      <p className="mt-2 text-sm text-muted">
        Es fehlen die Supabase-Zugangsdaten. Trage in Vercel (oder lokal in <code>.env.local</code>) diese Werte ein und
        starte die App neu:
      </p>
      <ul className="mt-4 space-y-1 rounded-lg border border-border bg-surface p-4 font-mono text-sm">
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        <li>ALLOWED_EMAIL</li>
      </ul>
      <p className="mt-4 text-sm text-muted">Die Schritt-für-Schritt-Anleitung steht im README des Repositorys.</p>
    </main>
  );
}
