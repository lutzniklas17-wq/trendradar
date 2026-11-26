/** Öffentliche Supabase-Werte (dürfen im Browser landen, sind durch Row Level Security geschützt). */
export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** E-Mail-Adresse des einzigen erlaubten Kontos. Nur serverseitig lesen. */
export function getAllowedEmail() {
  return process.env.ALLOWED_EMAIL?.trim().toLowerCase() || null;
}
