import { describe, expect, it } from "vitest";
import { LOGIN_MESSAGES, loginErrorMessage } from "@/lib/login-errors";
import { cleanEnv } from "@/lib/env";

describe("loginErrorMessage", () => {
  it("erkennt die häufigen Supabase-Fehler", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400, message: "Invalid login credentials" })).toBe(LOGIN_MESSAGES.invalidCredentials);
    expect(loginErrorMessage({ code: "email_not_confirmed", status: 400 })).toBe(LOGIN_MESSAGES.notConfirmed);
    expect(loginErrorMessage({ status: 401, message: "Invalid API key" })).toBe(LOGIN_MESSAGES.badKey);
    expect(loginErrorMessage({ status: 429 })).toBe(LOGIN_MESSAGES.tooMany);
    expect(loginErrorMessage({ name: "AuthRetryableFetchError", message: "fetch failed" })).toBe(LOGIN_MESSAGES.unreachable);
    expect(loginErrorMessage({ code: "unexpected_failure", status: 500 })).toContain("unexpected_failure");
  });
});

describe("cleanEnv", () => {
  it("entfernt Leerzeichen und Anführungszeichen", () => {
    expect(cleanEnv('  "sb_publishable_abc"\n')).toBe("sb_publishable_abc");
    expect(cleanEnv("   ")).toBeUndefined();
  });
});
