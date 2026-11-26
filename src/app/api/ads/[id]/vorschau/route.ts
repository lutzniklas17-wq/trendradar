import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getMetaEnv } from "@/lib/env";
import { renderAdUrl } from "@/lib/ads/feed";
import { libraryUrl } from "@/lib/ads/meta";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Leitet auf die offizielle Vorschau von Meta weiter (gleiche Seite wie ad_snapshot_url aus der API).
// Dort spielt Meta Bild oder Video selbst ab. TrendRadar lädt oder speichert keine Medien.
// Nur für den angemeldeten Besitzer: die Ziel-URL enthält das Meta-Token.
export async function GET(_req: Request, ctx: RouteContext<"/api/ads/[id]/vorschau">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new NextResponse("Ungültige Anzeige.", { status: 400 });
  const { supabase } = await requireOwner();
  const { data } = await supabase.from("ads").select("external_id, platform").eq("id", id).maybeSingle();
  if (!data || data.platform !== "meta") return new NextResponse("Anzeige nicht gefunden.", { status: 404 });
  const env = getMetaEnv();
  const target = env ? renderAdUrl(data.external_id, env.accessToken) : libraryUrl(data.external_id);
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
