import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bild aus dem Feed (direkt vom Verlag geladen, nicht kopiert) oder ein ruhiger Platzhalter. */
export function NewsImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-muted text-subtle", className)} aria-hidden>
        <Newspaper className="size-6" />
      </div>
    );
  }
  // Fremde Bilder ohne Optimierung einbinden: kein Proxy, kein Speichern, Verlag sieht keine Herkunftsseite.
  return (
    <div className={cn("overflow-hidden bg-surface-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
    </div>
  );
}
