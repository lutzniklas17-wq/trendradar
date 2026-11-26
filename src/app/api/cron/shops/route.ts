import { cronClient } from "@/lib/cron";
import { snapshotDueShops } from "@/lib/shops/service";

// Täglicher Lauf (Vercel Cron, siehe vercel.json): zählt die aktiven Anzeigen aller verfolgten Shops.
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = cronClient(request);
  if ("response" in auth) return auth.response;
  const result = await snapshotDueShops(auth.supabase, { max: 40 });
  return Response.json(result, { status: result.error ? 502 : 200 });
}
