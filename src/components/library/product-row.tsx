import Link from "next/link";
import { CalendarDays, ExternalLink, Package, Truck, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { getSupplierPlatform } from "@/lib/platforms";
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
  /** Plattform-ID wie in `SUPPLIER_PLATFORMS` (z. B. "cj", "aliexpress"). */
  platform?: string | null;
  /** Anzeigename, falls keine Plattform-ID bekannt ist. */
  supplier?: string | null;
  /** Interne Produktseite, falls übernommen. */
  item_id?: string | null;
};

export type ProductRowAds = { active: number; total: number } | null;

const count = new Intl.NumberFormat("de-CH");
const money = (v: number, currency: string) => new Intl.NumberFormat("de-CH", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
const day = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Zurich" });

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
 * Produkt als breite Zeile: Bild | Titel, Datum, Preis, Herkunft | Lieferant | Anzeigen.
 * `badges` z. B. für Einschätzungen, `save` für den Merken-Knopf unten rechts, `actions` für weitere Knöpfe.
 */
export function ProductRow({
  product: p,
  ads,
  rank,
  badges,
  save,
  actions,
  muted = false,
  adsHint = "Noch keine Anzeigen. Stichwort im Datensammler anlegen.",
}: {
  product: ProductRowData;
  /** Anzeigen über die Stichwörter des Produkts. `undefined` blendet die Spalte aus. */
  ads?: ProductRowAds;
  rank?: number;
  badges?: React.ReactNode;
  save?: React.ReactNode;
  actions?: React.ReactNode;
  muted?: boolean;
  adsHint?: string;
}) {
  const host = safeHost(p.product_url);
  const platform = p.platform ? getSupplierPlatform(p.platform) : undefined;
  const supplierName = platform?.name ?? p.supplier ?? null;
  const date = p.listed_at ?? p.first_seen_at ?? null;
  const showAds = ads !== undefined;

  return (
    <article
      className={cn(
        "grid overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-colors duration-150 hover:border-border-strong",
        "grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[208px_minmax(0,1fr)]",
        showAds ? "xl:grid-cols-[208px_minmax(0,1fr)_240px_280px]" : "xl:grid-cols-[208px_minmax(0,1fr)_260px]",
        muted && "opacity-60",
      )}
    >
      {/* Bild */}
      <div className="relative min-h-28 bg-surface-muted sm:min-h-52">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-subtle" aria-hidden>
            <Package className="size-7" strokeWidth={1.5} />
          </div>
        )}
        {rank ? (
          <span className="absolute top-2.5 left-2.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-surface/95 px-1.5 text-[12px] font-semibold tabular-nums shadow-xs">
            {rank}
          </span>
        ) : null}
      </div>

      {/* Hauptteil */}
      <div className="relative flex min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
        {p.item_id ? (
          <Link href={`/produkt/${p.item_id}`} className="line-clamp-2 text-[15px] leading-snug font-semibold transition-colors duration-150 hover:text-accent sm:text-[17px]">
            {p.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold sm:text-[17px]" title={p.title}>
            {p.title}
          </h3>
        )}
        {date ? (
          <p className="mt-2.5 flex items-center gap-2 text-[13px] text-muted tabular-nums">
            <CalendarDays className="size-4 text-subtle" aria-hidden />
            {p.listed_at ? "Beim Lieferanten seit" : "Gefunden am"} {day(date)}
          </p>
        ) : null}
        {p.price !== null && p.price !== undefined ? (
          <p className="mt-2 flex items-baseline gap-2" title="Einkaufspreis beim Lieferanten">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{money(p.price, p.currency ?? "USD")}</span>
            <span className="text-[12px] text-muted">Einkauf</span>
          </p>
        ) : null}
        {badges ? <div className="mt-2.5 flex flex-wrap gap-1.5">{badges}</div> : null}

        <div className="mt-auto flex flex-wrap items-end gap-x-4 gap-y-3 pt-4">
          {supplierName ? (
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              {platform ? <PlatformLogo icon={platform.icon} monogram={platform.monogram} color={platform.color} name={platform.name} className="size-6 rounded-md text-[9px]" /> : null}
              <span className="text-muted">von</span>
              {host ? (
                <a href={p.product_url!} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-medium underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
                  <span className="truncate">{supplierName}</span>
                  <ExternalLink className="size-3 shrink-0 text-subtle" aria-hidden />
                </a>
              ) : (
                <span className="font-medium">{supplierName}</span>
              )}
            </span>
          ) : host ? (
            <a href={p.product_url!} target="_blank" rel="noreferrer" className="text-[13px] font-medium underline decoration-border-strong underline-offset-4">
              {host}
            </a>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            {save}
          </div>
        </div>
      </div>

      {/* Lieferant */}
      <div className="col-span-2 border-t border-border px-5 py-4 sm:px-6 xl:col-span-1 xl:border-t-0 xl:border-l xl:py-5">
        <p className="text-[13px] font-semibold">Lieferant</p>
        <dl className="mt-3 space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted">
              <Users className="size-3.5" aria-hidden /> Von Shops übernommen
            </dt>
            <dd className="font-semibold tabular-nums">{p.listed_count !== null && p.listed_count !== undefined ? count.format(p.listed_count) : "–"}</dd>
          </div>
          {p.category_path ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">Kategorie</dt>
              <dd className="truncate text-right" title={p.category_path}>
                {p.category_path.split("/").pop()?.trim()}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
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
      </div>

      {/* Anzeigen */}
      {showAds ? (
        <div className="col-span-2 border-t border-border px-5 py-4 sm:px-6 xl:col-span-1 xl:border-t-0 xl:border-l xl:py-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold">Anzeigen</p>
            {ads ? (
              <p className="text-[13px] tabular-nums" title="Über die Stichwörter dieses Produkts im Datensammler gefunden">
                <span className="font-semibold text-positive">{ads.active} laufend</span>
                <span className="text-muted"> / {ads.total} bekannt</span>
              </p>
            ) : null}
          </div>
          {ads ? (
            p.item_id ? (
              <Link href={`/produkt/${p.item_id}#markt`} className="mt-3 inline-block text-[13px] text-accent hover:underline">
                Anzeigen ansehen →
              </Link>
            ) : null
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-subtle">{adsHint}</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
