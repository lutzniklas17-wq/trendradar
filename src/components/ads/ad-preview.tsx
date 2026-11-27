"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Medienfläche einer Anzeige. Zeigt zuerst den gespeicherten Anzeigentext.
 * Auf Klick lädt sie die offizielle Vorschau von Meta (Bild oder Video, abgespielt von Meta selbst).
 * Ohne Meta-Token gibt es keine eingebettete Vorschau, nur den Link zur Ad Library.
 */
export function AdPreview({
  adId,
  canEmbed,
  libraryHref,
  autoLoad = false,
  className,
  children,
}: {
  adId: string;
  canEmbed: boolean;
  libraryHref: string;
  autoLoad?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(autoLoad && canEmbed);

  return (
    <div className={cn("relative overflow-hidden rounded-md border border-border bg-surface-muted", className)}>
      {loaded ? (
        <>
          <iframe
            src={`/api/ads/${adId}/vorschau`}
            title="Vorschau der Anzeige von Meta"
            className="absolute inset-0 size-full bg-surface"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          <a
            href={libraryHref}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 bottom-2 inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[12px] text-muted shadow-card transition-colors duration-150 hover:text-foreground"
            title="Falls die Vorschau leer bleibt: Meta lässt die Einbettung gerade nicht zu."
          >
            Lädt nicht? Ad Library <ExternalLink className="size-3" aria-hidden />
          </a>
        </>
      ) : (
        <>
          <div className="absolute inset-0 overflow-hidden p-4">{children}</div>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-surface-muted/90" aria-hidden />
          {canEmbed ? (
            <button
              type="button"
              onClick={() => setLoaded(true)}
              className="absolute inset-x-0 bottom-3 mx-auto inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium shadow-card transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-card-hover"
            >
              <Play className="size-3.5 text-accent" aria-hidden /> Vorschau abspielen
            </button>
          ) : (
            <a
              href={libraryHref}
              target="_blank"
              rel="noreferrer"
              title="Eingebettete Vorschau braucht das Meta-Token (README „Meta Ad Spy“)."
              className="absolute inset-x-0 bottom-3 mx-auto inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium shadow-card transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-card-hover"
            >
              <Play className="size-3.5 text-accent" aria-hidden /> In der Ad Library ansehen
            </a>
          )}
        </>
      )}
    </div>
  );
}
