import { ExternalLink, EyeOff, Eye, Package, Truck, Video, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Claim } from "@/lib/library/top-hits";
import { cn } from "@/lib/utils";
import { ProductRow } from "@/components/library/product-row";
import { adoptProduct, toggleHidden } from "@/app/(app)/produkte/actions";

export type LibraryProduct = {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  currency: string;
  category_path: string | null;
  listed_count: number | null;
  free_shipping: boolean | null;
  has_video: boolean | null;
  product_url: string | null;
  relevance: "relevant" | "unclear" | "irrelevant";
  relevance_reason: string | null;
  hidden: boolean;
  item_id: string | null;
  ai_relevant: boolean | null;
  ai_score: number | null;
  ai_reason: string | null;
};

const count = new Intl.NumberFormat("de-CH");
const money = (v: number, currency: string) => new Intl.NumberFormat("de-CH", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);

const CLAIM_LABEL: Record<Claim["kind"], { label: string; tone: "positive" | "accent" | "warning" }> = {
  fact: { label: "Fakt", tone: "positive" },
  signal: { label: "Signal", tone: "accent" },
  assessment: { label: "Einschätzung", tone: "warning" },
};

/** Produktbild direkt vom Lieferanten (nicht kopiert) oder ein ruhiger Platzhalter. */
function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-surface-muted text-subtle" aria-hidden>
        <Package className="size-6" strokeWidth={1.5} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full bg-surface-muted object-cover" />;
}

export function ProductCard({ product: p, claims, rank }: { product: LibraryProduct; claims?: Claim[]; rank?: number }) {
  const excluded = p.relevance === "irrelevant" || p.ai_relevant === false;
  return (
    <article className={cn("group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-colors duration-150 hover:border-border-strong", p.hidden && "opacity-60")}>
      <div className="relative">
        <ProductImage src={p.image_url} alt={p.title} />
        {rank ? (
          <span className="absolute top-2 left-2 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 text-[11px] font-medium tabular-nums">
            {rank}
          </span>
        ) : null}
        {p.ai_score !== null ? (
          <Badge tone={p.ai_score >= 4 ? "accent" : "neutral"} className="absolute top-2 right-2 bg-surface" title={p.ai_reason ?? "KI-Einschätzung"}>
            KI {p.ai_score}/5
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3.5 pt-3 pb-3.5">
        <h3 className="line-clamp-2 text-[13px] leading-snug font-medium" title={p.title}>
          {p.title}
        </h3>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium tabular-nums">{p.price !== null ? money(p.price, p.currency) : "Preis fehlt"}</span>
          {p.listed_count !== null ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted tabular-nums" title="So oft haben Shops das Produkt bei CJ übernommen (Quelle: CJ API)">
              <Users className="size-3" aria-hidden /> {count.format(p.listed_count)}
            </span>
          ) : null}
        </div>
        {p.category_path ? <p className="truncate text-xs text-subtle">{p.category_path}</p> : null}

        <div className="flex flex-wrap gap-1">
          {p.free_shipping ? (
            <Badge>
              <Truck className="size-3" aria-hidden /> Gratisversand
            </Badge>
          ) : null}
          {p.has_video ? (
            <Badge>
              <Video className="size-3" aria-hidden /> Video
            </Badge>
          ) : null}
          {p.relevance === "unclear" ? <Badge tone="warning" title={p.relevance_reason ?? undefined}>Unklar</Badge> : null}
          {excluded ? (
            <Badge tone="negative" title={p.relevance_reason ?? p.ai_reason ?? undefined}>
              Ausgeschlossen
            </Badge>
          ) : null}
          {p.item_id ? <Badge tone="positive">Übernommen</Badge> : null}
        </div>
        {excluded && (p.relevance_reason || p.ai_reason) ? <p className="text-xs text-muted">{p.relevance_reason ?? p.ai_reason}</p> : null}

        {claims?.length ? (
          <ul className="mt-1 space-y-1.5 border-t border-border pt-2.5">
            {claims.map((c) => (
              <li key={c.text} className="text-xs leading-relaxed break-words text-muted">
                <Badge tone={CLAIM_LABEL[c.kind].tone} className="mr-1.5 align-[1px]">
                  {CLAIM_LABEL[c.kind].label}
                </Badge>
                {c.text}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center gap-0.5 pt-2">
          <ProductActions product={p} />
        </div>
      </div>
    </article>
  );
}

/** Übernehmen/Öffnen, beim Lieferanten ansehen, Aus- und Einblenden. */
function ProductActions({ product: p, full = true }: { product: LibraryProduct; full?: boolean }) {
  return (
    <>
          <form action={adoptProduct} className={full ? "min-w-0 flex-1" : undefined}>
            <input type="hidden" name="id" value={p.id} />
            <SubmitButton size="sm" variant={p.item_id ? "secondary" : "primary"} className="w-full min-w-0 px-2" pendingLabel="…">
              {p.item_id ? "Öffnen" : "Übernehmen"}
            </SubmitButton>
          </form>
          {p.product_url ? (
            <a
              href={p.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("ghost", "sm", "px-1.5")}
              title="Bei CJdropshipping ansehen"
              aria-label="Bei CJdropshipping ansehen"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
          <form action={toggleHidden}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="hide" value={p.hidden ? "0" : "1"} />
            <SubmitButton size="sm" variant="ghost" className="px-1.5" title={p.hidden ? "Wieder einblenden" : "Ausblenden"}>
              {p.hidden ? <Eye className="size-3.5" aria-label="Wieder einblenden" /> : <EyeOff className="size-3.5" aria-label="Ausblenden" />}
            </SubmitButton>
          </form>
    </>
  );
}

/** Bibliotheksprodukt als Zeile (Bild | Titel, Datum, Preis | Lieferant | Anzeigen). */
export function LibraryProductRow({
  product: p,
  ads,
  rank,
}: {
  product: LibraryProduct & { listed_at?: string | null; first_seen_at?: string | null };
  ads?: { active: number; total: number } | null;
  rank?: number;
}) {
  const excluded = p.relevance === "irrelevant" || p.ai_relevant === false;
  return (
    <ProductRow
      rank={rank}
      muted={p.hidden}
      product={{ ...p, supplier: "CJdropshipping" }}
      ads={ads}
      adsHint={p.item_id ? "Noch keine Anzeigen. Stichwort im Datensammler anlegen." : "Übernehmen, um Anzeigen zu diesem Produkt zu sammeln."}
      badges={
        <>
          {p.ai_score !== null ? (
            <Badge tone={p.ai_score >= 4 ? "accent" : "neutral"} title={p.ai_reason ?? "KI-Einschätzung"}>
              Einschätzung · KI {p.ai_score}/5
            </Badge>
          ) : null}
          {p.relevance === "unclear" ? <Badge tone="warning" title={p.relevance_reason ?? undefined}>Unklar</Badge> : null}
          {excluded ? (
            <Badge tone="negative" title={p.relevance_reason ?? p.ai_reason ?? undefined}>
              Ausgeschlossen
            </Badge>
          ) : null}
          {p.item_id ? <Badge tone="positive">Übernommen</Badge> : null}
        </>
      }
      actions={<ProductActions product={p} full={false} />}
    />
  );
}
