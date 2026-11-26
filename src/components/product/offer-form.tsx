"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OfferFormState } from "@/app/(app)/produkt/actions";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function OfferForm({
  action,
  platforms,
}: {
  action: (prev: OfferFormState, form: FormData) => Promise<OfferFormState>;
  platforms: { id: string; name: string; role: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Angebot erfassen
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <p className="text-sm font-semibold">Angebot erfassen</p>
        <p className="text-sm text-muted">
          Werte so eintragen, wie sie auf der Produktseite des Anbieters stehen. Leere Felder bleiben leer und werden
          nicht geschätzt.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          Plattform
          <select name="platform" required className={inputClass}>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.role === "price_reference" ? " (Preisreferenz)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          Link zur Produktseite
          <input name="url" type="url" required placeholder="https://" className={inputClass} />
        </label>
        <label className="text-sm sm:col-span-2">
          Titel beim Anbieter <span className="text-muted">(optional)</span>
          <input name="title" maxLength={300} className={inputClass} />
        </label>
        <label className="text-sm">
          Preis pro Stück
          <input name="price" inputMode="decimal" className={inputClass} />
        </label>
        <label className="text-sm">
          Währung
          <select name="currency" defaultValue="USD" className={inputClass}>
            <option>USD</option>
            <option>EUR</option>
            <option>CHF</option>
          </select>
        </label>
        <label className="text-sm">
          Versandkosten
          <input name="shipping_cost" inputMode="decimal" className={inputClass} />
        </label>
        <label className="text-sm">
          Lieferzeit
          <input name="shipping_days" placeholder="z. B. 7–12 Tage" maxLength={40} className={inputClass} />
        </label>
        <label className="text-sm">
          Zielland
          <input name="destination_country" placeholder="CH" maxLength={2} className={inputClass} />
        </label>
        <label className="text-sm">
          Mindestmenge (MOQ)
          <input name="moq" inputMode="numeric" className={inputClass} />
        </label>
        <label className="text-sm">
          Bewertung des Anbieters
          <input name="supplier_rating" inputMode="decimal" placeholder="z. B. 4.8 oder 97" className={inputClass} />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          Notiz <span className="text-muted">(optional)</span>
          <input name="note" maxLength={1000} className={inputClass} />
        </label>
      </div>
      {state.error ? <p className="text-sm text-negative">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-positive">Angebot gespeichert.</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Speichert …" : "Speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Schliessen
        </Button>
      </div>
    </form>
  );
}
