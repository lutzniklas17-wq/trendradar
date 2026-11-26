/** Öffentliche Supabase-Werte (dürfen im Browser landen, sind durch Row Level Security geschützt). */
export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Zugangsdaten für DataForSEO (API-Login und API-Passwort). Nur serverseitig lesen. */
export function getDataForSeoEnv() {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;
  const limit = Number(process.env.DATAFORSEO_DAILY_LIMIT);
  return { login, password, dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : 30 };
}

/** E-Mail-Adresse des einzigen erlaubten Kontos. Nur serverseitig lesen. */
export function getAllowedEmail() {
  return process.env.ALLOWED_EMAIL?.trim().toLowerCase() || null;
}
