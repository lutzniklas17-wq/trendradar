"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createProduct, type CreateProductState } from "@/app/(app)/produkt/actions";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent";

export function CreateProductForm() {
  const [state, formAction, pending] = useActionState<CreateProductState, FormData>(createProduct, {});
  const hasDuplicates = !!state.duplicates?.length;

  return (
    <form action={formAction} className="space-y-3 p-5">
      <label className="block text-sm">
        Produktname
        <input name="name" defaultValue={state.values?.name} required minLength={2} maxLength={200} className={inputClass} placeholder="z. B. LED-Gesichtsmaske" />
      </label>
      <label className="block text-sm">
        Kategorie <span className="text-muted">(optional)</span>
        <input name="category" defaultValue={state.values?.category} maxLength={100} className={inputClass} placeholder="z. B. Beauty" />
      </label>
      <label className="block text-sm">
        Wo entdeckt? <span className="text-muted">(Link, optional)</span>
        <input name="source_url" defaultValue={state.values?.source_url} type="url" className={inputClass} placeholder="https://" />
      </label>
      <label className="block text-sm">
        Notiz <span className="text-muted">(optional)</span>
        <textarea
          name="description"
          defaultValue={state.values?.description}
          maxLength={2000}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      {hasDuplicates ? (
        <div className="rounded-lg bg-warning/10 p-3 text-sm">
          <p className="font-medium text-warning">Ähnliche Einträge gibt es schon:</p>
          <ul className="mt-1 list-disc pl-5">
            {state.duplicates!.map((d) => (
              <li key={d.id}>
                <Link href={`/produkt/${d.id}`} className="underline">
                  {d.name}
                </Link>{" "}
                <span className="text-muted">({Math.round(d.similarity * 100)} % ähnlich)</span>
              </li>
            ))}
          </ul>
          <input type="hidden" name="confirm_duplicate" value="1" />
          <p className="mt-2 text-muted">Wenn es trotzdem ein anderes Produkt ist, nochmals auf Speichern klicken.</p>
        </div>
      ) : null}
      {state.error ? <p className="text-sm text-negative">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Speichert …" : hasDuplicates ? "Trotzdem speichern" : "Produkt anlegen"}
      </Button>
    </form>
  );
}
