import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { NewsImage } from "@/components/news/news-image";
import { requireOwner } from "@/lib/auth";
import { splitSource, timeAgo } from "@/lib/news";

export const metadata: Metadata = { title: "News" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewsArticlePage({ params }: PageProps<"/news/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("news_articles")
    .select("id, title, url, source_name, image_url, excerpt, published_at, fetched_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const { title, source } = splitSource(data.title);
  const publisher = source ?? data.source_name;
  const date = data.published_at ?? data.fetched_at;

  return (
    <article className="mx-auto max-w-2xl">
      <p className="mb-4 text-sm">
        <Link href="/news" className="text-accent hover:underline">
          ← Daily News
        </Link>
      </p>
      <p className="mb-2 text-[13px] text-muted">
        {publisher} · {new Date(date).toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "medium", timeStyle: "short" })} ({timeAgo(date)})
      </p>
      <h1 className="mb-6 text-xl font-medium leading-snug">{title}</h1>
      {data.image_url ? <NewsImage src={data.image_url} alt="" className="mb-6 aspect-[16/9] w-full rounded-lg" /> : null}
      <Card className="p-5">
        {data.excerpt ? (
          <p className="text-sm leading-relaxed">{data.excerpt}</p>
        ) : (
          <p className="text-sm text-muted">Der Feed liefert für diesen Artikel keinen Anrisstext.</p>
        )}
        <p className="mt-4 text-xs text-muted">
          Anrisstext aus dem Feed von {data.source_name}. Den vollständigen Artikel liest du beim Verlag; TrendRadar kopiert keine Volltexte.
        </p>
        <a href={data.url} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "mt-5")}>
          Ganzen Artikel bei {publisher} lesen <ExternalLink className="size-4" />
        </a>
      </Card>
    </article>
  );
}
