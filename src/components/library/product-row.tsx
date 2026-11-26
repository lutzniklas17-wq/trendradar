import Link from "next/link";
import { CalendarDays, ExternalLink, Package, Truck, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Felder für eine Produktzeile. Passt zu den Lieferanten-Produkten der Bibliothek, alles ausser id/title ist optional. */
export type ProductRowData = {
  id: string;
  title: string;
  image_url?: string | null;
  price?: number | null;
  currency?: string | null;
  category_path?: string | null;
  listed_count?: number | null;
  free_shipping?: boolean | null;
  has_video?: boolean | null;
  product_url?: string | null;
  /** Seit wann beim Lieferanten (z. B. CJ createAt). */
  listed_at?: string | null;
  /** Wann TrendRadar das Produkt zuerst gesehen hat. */
  first_seen_at?: string | null;
  supplier?: string | null;
  /** Interne Produktseite, falls übernommen. */
  item_id?: string | null;
};

export type ProductRowAds = { active: number; total: number } | null;

const count = new Intl.NumberFormat("de-CH");
const money = (v: number, currency: string) => new Intl.NumberFormat("de-CH", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
const day = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Zurich" });

function safeHost(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/**
 * Produkt als Zeile (Aufbau wie bei Produkt-Recherche-Tools üblich):
 * Bild | Titel, Datum, Preis, Link | Lieferanten-Kennzahlen | Anzeigen.
 * `badges` z. B. für Fakt/Signal/Einschätzung, `actions` für Knöpfe wie Übernehmen oder Ausblenden.
 */
export function ProductRow({
  product: p,
  ads,
  rank,
  badges,
  actions,
  muted = false,
}: {
  product: ProductRowData;
  /** Anzeigen über die Stichwörter des Produkts. `undefined` blendet die Spalte aus. */
  ads?: ProductRowAds;
  rank?: number;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  muted?: boolean;
}) {
  const host = safeHost(p.product_url);
  const date = p.listed_at ?? p.first_seen_at ?? null;
  const showAds = ads !== undefined;
  return (
    <article
      className={cn(
        "grid overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-colors duration-150 hover:border-border-strong",
        "grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)]",
        showAds ? "lg:grid-cols-[176px_minmax(0,1fr)_200px_200px]" : "lg:grid-cols-[176px_minmax(0,1fr)_220px]",
        muted && "opacity-60",
      )}
    >
      <div className="relative min-h-28 bg-surface-muted sm:min-h-44">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-subtle" aria-hidden>
            <Package className="size-6" strokeWidth={1.5} />
          </div>
        )}
        {rank ? (
          <span className="absolute top-2 left-2 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 text-[11px] font-medium tabular-nums">
            {rank}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2 px-4 py-4 sm:px-5">
        {p.item_id ? (
          <Link href={`/produkt/${p.item_id}`} className="line-clamp-2 text-sm font-medium transition-colors duration-150 hover:text-accent">
            {p.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-sm font-medium">{p.title}</h3>
        )}
        {date ? (
          <p className="flex items-center gap-1.5 text-[12px] text-muted tabular-nums">
            <CalendarDays className="size-3.5" aria-hidden />
            {p.listed_at ? "Beim Lieferanten seit" : "Gefunden am"} {day(date)}
          </p>
        ) : null}
        {p.price !== null && p.price !== undefined ? (
          <p className="text-xl tabular-nums" title="Einkaufspreis beim Lieferanten">
            {money(p.price, p.currency ?? "USD")}
            <span className="ml-1.5 text-[12px] text-muted">Einkauf</span>
          </p>
        ) : null}
        {p.category_path ? <p className="truncate text-[12px] text-subtle">{p.category_path}</p> : null}
        {badges ? <div className="flex flex-wrap gap-1.5">{badges}</div> : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          {host ? (
            <a href={p.product_url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-muted underline-offset-2 hover:text-foreground hover:underline">
              {host} <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
          {actions ? <div className="ml-auto flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>

      <div className="col-span-2 border-t border-border px-5 py-4 lg:col-span-1 lg:border-t-0 lg:border-l">
        <p className="text-[13px] text-muted">{p.supplier ? `Lieferant · ${p.supplier}` : "Lieferant"}</p>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[12px] text-muted">Von Shops übernommen</dt>
            <dd className="tabular-nums">{p.listed_count !== null && p.listed_count !== undefined ? count.format(p.listed_count) : "–"}</dd>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.free_shipping ? (
              <Badge>
                <Truck className="size-3" aria-hidden /> Gratisversand
              </Badge>
            ) : null}
            {p.has_video ? (
              <Badge>
                <Video className="size-3" aria-hidden /> Video vorhanden
              </Badge>
            ) : null}
          </div>
        </dl>
      </div>

      {showAds ? (
        <div className="col-span-2 border-t border-border px-5 py-4 lg:col-span-1 lg:border-t-0 lg:border-l">
          <p className="text-[13px] text-muted">Anzeigen</p>
          {ads ? (
            <p className="mt-2 text-sm tabular-nums" title="Über die Stichwörter dieses Produkts im Datensammler gefunden">
              <span className="text-positive">{ads.active} laufend</span> / {ads.total} bekannt
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-subtle">Noch keine Anzeigen. Stichwort im Datensammler anlegen.</p>
          )}
          {p.item_id ? (
            <Link href={`/produkt/${p.item_id}`} className="mt-2 inline-block text-[12px] text-accent hover:underline">
              Zum Produkt →
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
