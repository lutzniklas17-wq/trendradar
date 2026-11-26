import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Supabase-Client mit Service-Role-Key, nur für den täglichen Lauf. Umgeht Row Level Security. */
export function createSupabaseAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
