import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/** Überschrift eines Seitenabschnitts: Titel (optional mit Symbol), kurze Erklärung, Link rechts („Alle ansehen“). */
export function SectionHeader({
  id,
  title,
  icon: Icon,
  description,
  href,
  linkLabel = "Alle ansehen",
}: {
  id?: string;
  title: string;
  icon?: LucideIcon;
  description?: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-base font-medium tracking-tight">
          {Icon ? <Icon className="size-4 text-accent" aria-hidden strokeWidth={1.75} /> : null}
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="group inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-colors duration-150 hover:text-accent-hover">
          {linkLabel}
          <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
