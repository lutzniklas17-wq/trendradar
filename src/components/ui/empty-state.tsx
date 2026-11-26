import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 rounded-md border border-border bg-surface-muted p-2.5 text-muted">
        <Icon className="size-4" aria-hidden strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}
