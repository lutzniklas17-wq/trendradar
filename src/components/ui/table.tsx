import { cn } from "@/lib/utils";

/**
 * Einheitliche Tabelle: Rahmen wie eine Karte, ruhiger Kopf, Zeilen heben sich beim Darüberfahren leicht ab.
 * Auf schmalen Bildschirmen scrollt nur die Tabelle, nicht die Seite.
 */
export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-[13px]", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-border bg-surface-muted/50", className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-9 px-4 text-[12px] font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5", className)} {...props} />;
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-hover", className)} {...props} />;
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", className)} {...props} />;
}
