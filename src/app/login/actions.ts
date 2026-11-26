"use server";

import { redirect } from "next/navigation";
import { getAllowedEmail } from "@/lib/env";
import { LOGIN_MESSAGES, loginErrorMessage } from "@/lib/login-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const allowed = getAllowedEmail();
  if (!email || !password) return { error: LOGIN_MESSAGES.empty };
  if (allowed && email !== allowed) return { error: LOGIN_MESSAGES.notAllowed };

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/setup");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Nur Code und Status ins Server-Log (Vercel → Logs), nie E-Mail oder Passwort.
    console.error("Login fehlgeschlagen", { code: error.code, status: error.status, name: error.name });
    return { error: loginErrorMessage(error) };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
