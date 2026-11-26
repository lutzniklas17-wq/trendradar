import Link from "next/link";
import { ChevronRight, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { requireOwner } from "@/lib/auth";
import {
  filterStartups,
  hasStartupFilters,
  parseStartupFilters,
  resultLabel,
  STARTUP_LAUNCH,
  STARTUP_RELEVANCE,
  STARTUP_SORTS,
  STARTUP_SOURCES,
  STARTUP_STAGES,
  type FilterableStartup,
} from "@/lib/list-filters";
import { websiteHost } from "@/lib/collect/discoveries";
import { formatDate } from "@/lib/utils";

type Row = FilterableStartup & { id: string; is_new: boolean; relevance_reason: string | null };

const STAGE_LABEL: Record<string, string> = { startup: "Startup", small_business: "Small Business" };
const SOURCE_LABEL: Record<string, string> = {
  meta_new_advertisers: "Neue Werbetreibende",
  product_hunt: "Product Hunt",
  rss: "RSS",
};
const START_LABEL: Record<string, string> = {
  meta_new_advertisers: "erste bekannte Anzeige",
  product_hunt: "Launch",
  rss: "veröffentlicht",
};

const PATH = "/startup-spy";

export async function StartupList({ params }: { params: Record<string, string | string[] | undefined> }) {
  const filters = parseStartupFilters(params);
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("items")
    .select("id, name, description, website_url, stage, launched_at, relevance, relevance_reason, source_id, first_discovered_at, is_new")
    .eq("area", "startup_spy")
    .neq("relevance", "excluded")
    .order("first_discovered_at", { ascending: false })
    .limit(1000);
  const all = (data ?? []) as Row[];
  const items = filterStartups(all, filters);

  return (
    <Card>
      <CardHeader
        title="Neue Marken und Shops"
        description="Täglich gesammelt. „Gestartet“ ist das Datum aus der Quelle: Launch bei Product Hunt, erste bekannte Anzeige bei neuen Werbetreibenden. Die E-Commerce-Einstufung folgt festen Regeln und ist eine Einschätzung."
      />
      {all.length ? (
        <FilterBar
          path={PATH}
          query={filters.text}
          queryPlaceholder="Name, Domain…"
          active={hasStartupFilters(filters)}
          resultLabel={resultLabel(items.length, all.length)}
          controls={[
            { kind: "select", name: "art", label: "Art", value: filters.stage, options: STARTUP_STAGES },
            { kind: "select", name: "gestartet", label: "Gestartet", value: filters.launchedDays ? String(filters.launchedDays) : "", options: STARTUP_LAUNCH },
            { kind: "select", name: "relevanz", label: "Relevanz", value: filters.relevance, options: STARTUP_RELEVANCE },
            { kind: "select", name: "quelle", label: "Quelle", value: filters.source, options: STARTUP_SOURCES },
            { kind: "select", name: "sortierung", label: "Sortierung", value: filters.sort, options: STARTUP_SORTS },
          ]}
        />
      ) : null}
      {error ? (
        <EmptyState icon={Rocket} title="Datenbank nicht bereit">
          Ist die Migration 0007 ausgeführt? Siehe README „Startup Spy“.
        </EmptyState>
      ) : items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const host = websiteHost(item.website_url);
            return (
              <li key={item.id}>
                <Link
                  href={`/produkt/${item.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-3 transition-colors duration-150 hover:bg-surface-muted/60"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{item.name}</span>
                      {item.is_new ? <Badge tone="accent">neu</Badge> : null}
                      {item.stage ? <Badge>{STAGE_LABEL[item.stage] ?? item.stage}</Badge> : null}
                      {item.relevance === "ecommerce" ? (
                        <Badge tone="positive" title={`Einschätzung nach Regeln: ${item.relevance_reason ?? ""}`}>
                          E-Commerce
                        </Badge>
                      ) : (
                        <Badge title={`Einschätzung nach Regeln: ${item.relevance_reason ?? "noch nicht eingestuft"}`}>unklar</Badge>
                      )}
                    </p>
                    {item.description ? <p className="mt-0.5 truncate text-[13px] text-muted">{item.description}</p> : null}
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted tabular-nums">
                      {host ? <span>{host}</span> : null}
                      {item.launched_at ? (
                        <span>
                          {START_LABEL[item.source_id ?? ""] ?? "gestartet"} {formatDate(item.launched_at)}
                        </span>
                      ) : null}
                      <span>entdeckt {formatDate(item.first_discovered_at)}</span>
                      {item.source_id ? <span>{SOURCE_LABEL[item.source_id] ?? item.source_id}</span> : null}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-subtle transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : all.length ? (
        <EmptyState icon={Rocket} title="Keine Einträge für diese Filter">
          <Link href={PATH} className="text-accent hover:underline">
            Filter zurücksetzen
          </Link>
        </EmptyState>
      ) : (
        <EmptyState icon={Rocket} title="Noch keine Einträge">
          Es werden keine Beispieldaten angezeigt. Einträge kommen über die{" "}
          <Link href="/sammler" className="text-accent hover:underline">
            Datensammler
          </Link>
          : neue Werbetreibende aus deinen Anzeigen-Stichwörtern, Product Hunt und RSS-Feeds.
        </EmptyState>
      )}
    </Card>
  );
}
