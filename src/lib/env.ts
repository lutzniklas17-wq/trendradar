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

/** Zugang zur Meta Ad Library API. Nur serverseitig lesen, das Token nie an den Browser geben. */
export function getMetaEnv() {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;
  const version = process.env.META_GRAPH_VERSION?.trim();
  return { accessToken, graphVersion: version && /^v\d+\.\d+$/.test(version) ? version : undefined };
}

/**
 * Zugang für den täglichen Lauf (Vercel Cron). Der Service-Role-Key umgeht Row Level Security
 * und darf nur serverseitig in diesem Lauf verwendet werden.
 */
export function getCronEnv() {
  const secret = process.env.CRON_SECRET?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!secret || secret.length < 16 || !serviceRoleKey || !url) return null;
  return { secret, serviceRoleKey, url };
}
