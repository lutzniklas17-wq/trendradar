import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getCronEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { snapshotDueShops } from "@/lib/shops/service";

// Täglicher Lauf (Vercel Cron, siehe vercel.json): zählt die aktiven Anzeigen aller verfolgten Shops.
export const maxDuration = 300;

function authorized(request: NextRequest, secret: string) {
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(request: NextRequest) {
  const env = getCronEnv();
  if (!env) return Response.json({ error: "CRON_SECRET oder SUPABASE_SERVICE_ROLE_KEY fehlt." }, { status: 503 });
  if (!authorized(request, env.secret)) return Response.json({ error: "Nicht berechtigt." }, { status: 401 });

  const supabase = createSupabaseAdminClient(env.url, env.serviceRoleKey);
  const result = await snapshotDueShops(supabase, { max: 40 });
  return Response.json(result, { status: result.error ? 502 : 200 });
}
