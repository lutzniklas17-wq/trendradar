import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface shadow-card">
            <Radar className="size-5" aria-hidden strokeWidth={1.75} />
          </span>
          <h1 className="text-lg font-medium tracking-tight">TrendRadar</h1>
          <p className="mt-1 text-sm text-muted">Privater Zugang</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
