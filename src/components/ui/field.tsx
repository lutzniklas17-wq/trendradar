import { cn } from "@/lib/utils";

/** Einheitlicher Stil für Eingabefelder und Auswahllisten. */
export const inputClass =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-card outline-none transition-colors duration-150 placeholder:text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/15";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export type SelectOption = { value: string; label: string };

export function Select({
  options,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly SelectOption[] }) {
  return (
    <select className={cn(inputClass, "cursor-pointer pr-8", className)} {...props}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
