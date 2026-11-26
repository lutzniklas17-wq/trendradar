import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAllowedEmail } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Data-Access-Layer: prüft die Sitzung serverseitig, unabhängig vom Proxy. */
export async function requireOwner() {
  // Immer pro Anfrage prüfen, nie beim Build vorrendern (auch wenn beim Build keine Umgebungsvariablen gesetzt sind).
  await connection();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : null;
  const allowed = getAllowedEmail();
  if (!data?.claims || (allowed && email !== allowed)) redirect("/login");
  return { supabase, email };
}
