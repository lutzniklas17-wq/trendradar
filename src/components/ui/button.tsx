import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-contrast shadow-card hover:bg-accent-hover active:bg-accent-hover",
  secondary:
    "border border-border bg-surface text-foreground shadow-card hover:border-border-strong hover:bg-surface-hover active:bg-surface-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground active:bg-surface-muted",
  danger: "text-muted hover:bg-negative/10 hover:text-negative active:bg-negative/15",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-[13px]",
  md: "h-9 gap-2 px-3.5 text-sm",
};

/** Gemeinsame Klassen, damit Links (z. B. „Zurücksetzen“) wie Buttons aussehen können. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
