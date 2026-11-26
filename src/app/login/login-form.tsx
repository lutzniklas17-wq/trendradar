"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">E-Mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm shadow-xs outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Passwort</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm shadow-xs outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Anmelden…" : "Anmelden"}
      </Button>
    </form>
  );
}
