/**
 * Verständliche Meldungen für die Anmeldung. Private Ein-Personen-Seite: Die Meldung darf sagen, woran es liegt,
 * damit der Besitzer es selbst beheben kann. Passwörter werden nie gezeigt oder geloggt.
 */
export const LOGIN_MESSAGES = {
  empty: "Bitte E-Mail und Passwort eingeben.",
  notAllowed: "Diese E-Mail ist nicht freigeschaltet. Sie muss genau gleich sein wie ALLOWED_EMAIL in Vercel.",
  invalidCredentials: "E-Mail oder Passwort falsch, oder es gibt diesen Benutzer in Supabase nicht (Authentication → Users).",
  notConfirmed: "Die E-Mail ist in Supabase noch nicht bestätigt. Benutzer neu anlegen mit „Auto Confirm User“.",
  badKey: "Supabase lehnt den Schlüssel ab. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel prüfen und neu deployen.",
  tooMany: "Zu viele Versuche. Bitte ein paar Minuten warten.",
  unreachable: "Supabase ist nicht erreichbar. Ist das Projekt pausiert? NEXT_PUBLIC_SUPABASE_URL prüfen.",
} as const;

type AuthErrorLike = { code?: string; status?: number; message?: string; name?: string };

export function loginErrorMessage(error: AuthErrorLike): string {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "email_not_confirmed" || message.includes("not confirmed")) return LOGIN_MESSAGES.notConfirmed;
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return LOGIN_MESSAGES.invalidCredentials;
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) return LOGIN_MESSAGES.tooMany;
  if (message.includes("api key") || message.includes("apikey") || error.status === 401) return LOGIN_MESSAGES.badKey;
  if (error.name === "AuthRetryableFetchError" || message.includes("fetch") || !error.status) return LOGIN_MESSAGES.unreachable;
  return `Anmeldung fehlgeschlagen (Supabase: ${code || error.status}).`;
}
