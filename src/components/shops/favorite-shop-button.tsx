import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFavoriteShop } from "@/app/(app)/shop-spy/actions";

/** Stern zum Favorisieren eines Shops. Favoriten melden in der Inbox jede Veränderung. */
export function FavoriteShopButton({ id, favorite, withLabel = false }: { id: string; favorite: boolean; withLabel?: boolean }) {
  return (
    <form action={toggleFavoriteShop} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="favorit" value={favorite ? "0" : "1"} />
      <button
        type="submit"
        title={favorite ? "Aus Favoriten entfernen" : "Als Favorit merken: jede Veränderung landet in der Inbox"}
        className={cn("inline-flex items-center gap-1 rounded-md p-1 text-sm transition-colors duration-150", favorite ? "text-accent" : "text-subtle hover:text-foreground")}
      >
        <Star className={cn("size-4", favorite && "fill-current")} aria-hidden />
        {withLabel ? (favorite ? "Favorit" : "Favorisieren") : <span className="sr-only">{favorite ? "Favorit entfernen" : "Favorisieren"}</span>}
      </button>
    </form>
  );
}
