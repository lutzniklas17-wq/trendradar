import { BRAND_ICONS, type BrandIconKey } from "@/lib/brand-icons";
import { cn } from "@/lib/utils";

/** Logo einer Plattform; ohne frei nutzbares Logo ein farbiges Kürzel. */
export function PlatformLogo({
  icon,
  monogram,
  color,
  name,
  className,
}: {
  icon?: BrandIconKey;
  monogram: string;
  color: string;
  name: string;
  className?: string;
}) {
  const brand = icon ? BRAND_ICONS[icon] : null;
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-xs font-medium",
        className,
      )}
      style={brand ? undefined : { color }}
      title={name}
    >
      {brand ? (
        <svg viewBox="0 0 24 24" className="size-5" role="img" aria-label={name} fill={brand.hex === "#000000" ? "#111" : brand.hex}>
          <path d={brand.path} />
        </svg>
      ) : (
        <span aria-label={name}>{monogram}</span>
      )}
    </span>
  );
}
