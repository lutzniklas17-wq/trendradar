import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCronEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function authorized(header: string | null, secret: string) {
  const got = Buffer.from(header ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Prüft das CRON_SECRET (Vercel Cron schickt es als Bearer-Token) und gibt den Admin-Client oder eine Fehlerantwort zurück. */
export function cronClient(request: Request): { supabase: SupabaseClient } | { response: Response } {
  const env = getCronEnv();
  if (!env) return { response: Response.json({ error: "CRON_SECRET oder SUPABASE_SERVICE_ROLE_KEY fehlt." }, { status: 503 }) };
  if (!authorized(request.headers.get("authorization"), env.secret)) return { response: Response.json({ error: "Nicht berechtigt." }, { status: 401 }) };
  return { supabase: createSupabaseAdminClient(env.url, env.serviceRoleKey) };
}
