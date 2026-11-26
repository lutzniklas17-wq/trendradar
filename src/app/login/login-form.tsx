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
          className="h-10 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-accent"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Passwort</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-accent"
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
