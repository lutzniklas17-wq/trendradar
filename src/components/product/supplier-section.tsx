import { Check, ExternalLink, Search, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { OfferForm } from "@/components/product/offer-form";
import { addOffer, deleteOffer, setOfferStatus } from "@/app/(app)/produkt/actions";
import { SUPPLIER_PLATFORMS, type SupplierPlatform } from "@/lib/platforms";
import type { Offer } from "@/lib/offers";
import { cn, formatDate, formatNumber } from "@/lib/utils";

const ACCESS_LABEL: Record<SupplierPlatform["dataAccess"], string> = {
  api: "Daten per API",
  api_planned: "API geplant",
  manual: "Manuelle Erfassung",
};

const STATUS_LABEL = {
  candidate: { label: "Kandidat", tone: "neutral" },
  confirmed: { label: "Passt", tone: "positive" },
  rejected: { label: "Passt nicht", tone: "negative" },
} as const;

function Value({ value, suffix }: { value: string | number | null; suffix?: string }) {
  if (value == null || value === "") return <span className="text-muted">–</span>;
  return (
    <span className="tabular-nums">
      {typeof value === "number" ? formatNumber(value) : value}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
}

function OfferRow({ offer, itemId }: { offer: Offer; itemId: string }) {
  const status = STATUS_LABEL[offer.matchStatus];
  return (
    <tr className={cn("transition-colors duration-150 hover:bg-surface-hover", offer.matchStatus === "rejected" && "opacity-50")}>
      <td className="px-4 py-3">
        <a href={offer.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium hover:text-accent">
          {offer.title ?? "Produktseite"} <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <ProvenanceBadge kind={offer.dataOrigin === "api" ? "data" : "manual"} />
          <Badge tone={status.tone}>{status.label}</Badge>
          <span>Stand {formatDate(offer.updatedAt)}</span>
        </div>
        {offer.note ? <p className="mt-1 text-xs text-muted">{offer.note}</p> : null}
      </td>
      <td className="px-4 py-3">
        <Value value={offer.price} suffix={offer.currency ?? undefined} />
      </td>
      <td className="px-4 py-3">
        <Value value={offer.shippingCost} suffix={offer.currency ?? undefined} />
        {offer.destinationCountry ? <span className="block text-xs text-muted">nach {offer.destinationCountry}</span> : null}
      </td>
      <td className="px-4 py-3">
        <Value value={offer.shippingDays} />
      </td>
      <td className="px-4 py-3">
        <Value value={offer.moq == null ? null : offer.moq.toLocaleString("de-CH")} />
      </td>
      <td className="px-4 py-3">
        <Value value={offer.supplierRating == null ? null : String(offer.supplierRating)} />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {(["confirmed", "rejected"] as const)
            .filter((s) => s !== offer.matchStatus)
            .map((s) => (
              <form key={s} action={setOfferStatus}>
                <input type="hidden" name="item_id" value={itemId} />
                <input type="hidden" name="offer_id" value={offer.id} />
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                  title={s === "confirmed" ? "Ist dasselbe Produkt" : "Ist nicht dasselbe Produkt"}
                >
                  {s === "confirmed" ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                  <span className="sr-only">{s === "confirmed" ? "Als passend markieren" : "Als unpassend markieren"}</span>
                </button>
              </form>
            ))}
          <form action={deleteOffer}>
            <input type="hidden" name="item_id" value={itemId} />
            <input type="hidden" name="offer_id" value={offer.id} />
            <button type="submit" className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-negative" title="Löschen">
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">Angebot löschen</span>
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function PlatformBlock({
  platform,
  offers,
  itemId,
  query,
}: {
  platform: SupplierPlatform;
  offers: Offer[];
  itemId: string;
  query: string;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <PlatformLogo icon={platform.icon} monogram={platform.monogram} color={platform.color} name={platform.name} />
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              {platform.name}
              <Badge>{ACCESS_LABEL[platform.dataAccess]}</Badge>
            </p>
            <p className="text-xs text-muted">{platform.note}</p>
          </div>
        </div>
        <a
          href={platform.searchUrl(query)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-muted"
        >
          <Search className="size-3.5" aria-hidden /> Auf {platform.name} suchen
        </a>
      </div>
      {offers.length ? (
        <div className="relative overflow-x-auto border-t border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-surface-muted/50 text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Angebot</th>
                <th className="px-4 py-2 font-medium">Preis</th>
                <th className="px-4 py-2 font-medium">Versand</th>
                <th className="px-4 py-2 font-medium">Lieferzeit</th>
                <th className="px-4 py-2 font-medium">MOQ</th>
                <th className="px-4 py-2 font-medium">Bewertung</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offers.map((o) => (
                <OfferRow key={o.id} offer={o} itemId={itemId} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-border px-5 py-3 text-sm text-muted">Noch kein Angebot erfasst.</p>
      )}
    </Card>
  );
}

export function SupplierSection({ itemId, query, offers }: { itemId: string; query: string; offers: Offer[] }) {
  const suppliers = SUPPLIER_PLATFORMS.filter((p) => p.role === "supplier");
  const references = SUPPLIER_PLATFORMS.filter((p) => p.role === "price_reference");
  const byPlatform = (id: string) => offers.filter((o) => o.platform === id);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Lieferanten</h2>
            <p className="text-sm text-muted">
              Wo du einkaufst. Die Suchlinks öffnen die Plattform; bestätigte Angebote fliessen in den Rechner.
            </p>
          </div>
        </div>
        <OfferForm
          action={addOffer.bind(null, itemId)}
          platforms={SUPPLIER_PLATFORMS.map(({ id, name, role }) => ({ id, name, role }))}
        />
        {suppliers.map((p) => (
          <PlatformBlock key={p.id} platform={p} offers={byPlatform(p.id)} itemId={itemId} query={query} />
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-medium">Preisreferenz</h2>
          <p className="text-sm text-muted">
            Kein Einkauf: zeigt, zu welchem Preis Kunden das Produkt anderswo finden. Wichtig für deinen Verkaufspreis.
          </p>
        </div>
        {references.map((p) => (
          <PlatformBlock key={p.id} platform={p} offers={byPlatform(p.id)} itemId={itemId} query={query} />
        ))}
      </section>
    </div>
  );
}
