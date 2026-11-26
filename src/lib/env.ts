/** Öffentliche Supabase-Werte (dürfen im Browser landen, sind durch Row Level Security geschützt). */
/** Entfernt Leerzeichen, Zeilenumbrüche und versehentlich mitkopierte Anführungszeichen. */
export function cleanEnv(value: string | undefined) {
  const v = value?.trim().replace(/^["']|["']$/g, "").trim();
  return v || undefined;
}

export function getPublicSupabaseEnv() {
  // Werte mit NEXT_PUBLIC_ werden beim Build eingesetzt: nach einer Änderung in Vercel neu deployen.
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
  const anonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
  return cleanEnv(process.env.ALLOWED_EMAIL)?.toLowerCase() || null;
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

/** Developer Token der Product Hunt API v2 (kostenlos, nur private, nicht kommerzielle Nutzung). Nur serverseitig lesen. */
export function getProductHuntEnv() {
  const token = process.env.PRODUCTHUNT_TOKEN?.trim();
  return token ? { token } : null;
}

/** Zugang zur CJdropshipping API (kostenlos mit CJ-Konto). Nur serverseitig lesen. */
export function getCjEnv() {
  const apiKey = process.env.CJ_API_KEY?.trim();
  if (!apiKey) return null;
  const limit = Number(process.env.CJ_DAILY_LIMIT);
  // CJ erlaubt kostenlosen Konten 1000 Anfragen pro Tag; Standard bewusst tiefer.
  return { apiKey, dailyLimit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 300 };
}

/** Claude API für die KI-Bewertung. Ohne Key bleibt die KI aus. Nur serverseitig lesen. */
export function getAnthropicEnv() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const budget = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return { apiKey, monthlyBudgetUsd: Number.isFinite(budget) && budget > 0 ? Math.min(budget, 100) : 5 };
}
