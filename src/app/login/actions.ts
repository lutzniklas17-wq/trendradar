"use server";

import { redirect } from "next/navigation";
import { getAllowedEmail } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const allowed = getAllowedEmail();
  const generic = { error: "Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen." };

  if (!email || !password) return generic;
  if (allowed && email !== allowed) return generic;

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return generic;
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
