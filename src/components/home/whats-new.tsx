import Link from "next/link";
import { ArrowRight, Inbox, Newspaper, Rocket, ShoppingBag, Sparkles, type LucideIcon } from "lucide-react";
import { ProductCard } from "@/components/library/product-card";
import { cardClass } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { requireOwner } from "@/lib/auth";
import { countNew } from "@/lib/home/whats-new";
import { loadTopHits } from "@/lib/library/load";

const nf = new Intl.NumberFormat("de-CH");

function Tile({ href, icon: Icon, label, value, hint }: { href: string; icon: LucideIcon; label: string; value: number | null; hint: string }) {
  return (
    <Link href={href} className={cardClass(true, "group px-5 py-4")}>
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-surface-muted text-muted transition-colors duration-150 group-hover:bg-accent-soft group-hover:text-accent">
            <Icon className="size-3.5" aria-hidden strokeWidth={1.75} />
          </span>
          {label}
        </span>
        <ArrowRight className="size-3.5 text-subtle transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value === null ? "–" : nf.format(value)}</p>
      <p className="mt-0.5 text-xs text-subtle">{value === null ? "Migration fehlt" : hint}</p>
    </Link>
  );
}

/** Oberer Block der Startseite: was seit gestern neu ist, und die besten Produkte aus der Bibliothek. */
export async function WhatsNew() {
  const { supabase } = await requireOwner();
  const [counts, hits] = await Promise.all([countNew(supabase), loadTopHits(supabase, 4)]);

  return (
    <>
      <section aria-labelledby="neu" className="mb-8">
        <SectionHeader id="neu" title="Neu seit gestern" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile href="/produkte?sortierung=gefunden" icon={ShoppingBag} label="Produkte" value={counts.products} hint="neu in der Bibliothek, 24 h" />
          <Tile href="/startup-spy" icon={Rocket} label="Startups" value={counts.startups} hint="neu entdeckt, 24 h" />
          <Tile href="/inbox" icon={Inbox} label="Inbox" value={counts.inbox} hint="ungelesene Änderungen" />
          <Tile href="/news" icon={Newspaper} label="News" value={counts.news} hint="neue Artikel, 24 h" />
        </div>
      </section>

      {hits.length ? (
        <section aria-labelledby="top-hits-start" className="mb-10">
          <SectionHeader id="top-hits-start" icon={Sparkles} title="Top-Hits Produkte" href="/produkte" linkLabel="Alle Top-Hits" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {hits.map(({ hit, product }, i) => (
              <ProductCard key={hit.id} product={product} claims={hit.claims} rank={i + 1} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
