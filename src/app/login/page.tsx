import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 rounded-xl bg-accent p-2.5 text-white dark:text-black">
            <Radar className="size-6" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold">TrendRadar</h1>
          <p className="mt-1 text-sm text-muted">Privater Zugang</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
