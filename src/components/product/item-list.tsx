import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export type ItemListEntry = {
  id: string;
  name: string;
  category: string | null;
  area?: string;
  first_discovered_at?: string;
  is_new?: boolean;
  note?: string | null;
};

const AREA_LABEL: Record<string, string> = {
  trend_spy: "Trend Spy",
  ad_spy: "Ad Spy",
  startup_spy: "Startup Spy",
  future_radar: "Future Radar",
};

export function ItemList({ items, showArea = false }: { items: ItemListEntry[]; showArea?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/produkt/${item.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {item.name}
                {item.is_new ? <Badge tone="accent">neu</Badge> : null}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                {showArea && item.area ? <span>{AREA_LABEL[item.area] ?? item.area}</span> : null}
                {item.category ? <span>{item.category}</span> : null}
                {item.first_discovered_at ? <span>entdeckt {formatDate(item.first_discovered_at)}</span> : null}
                {item.note ? <span className="truncate">„{item.note}“</span> : null}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
