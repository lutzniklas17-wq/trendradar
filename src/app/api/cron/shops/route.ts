import { cronClient } from "@/lib/cron";
import { discoverShops, snapshotDueShops } from "@/lib/shops/service";

// Täglicher Lauf (Vercel Cron, siehe vercel.json): zählt die aktiven Anzeigen aller verfolgten Shops.
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = cronClient(request);
  if ("response" in auth) return auth.response;
  // Zuerst neue Shops aus den gesammelten Anzeigen aufnehmen (ohne Meta-Abfrage), dann alle fälligen zählen.
  const discovery = await discoverShops(auth.supabase);
  const result = await snapshotDueShops(auth.supabase, { max: 40 });
  await auth.supabase.from("research_runs").insert({
    job: "shops",
    finished_at: new Date().toISOString(),
    status: result.error ? (result.checked ? "partial" : "failed") : "success",
    new_items: discovery.added.length,
    log: {
      message:
        `${discovery.added.length} Shops automatisch entdeckt, ${discovery.paused} pausiert, ${result.checked} gezählt` +
        (result.remaining ? `, ${result.remaining} offen` : "") +
        (discovery.error ? `. ${discovery.error}` : "") +
        (result.error ? `. ${result.error}` : "."),
    },
  });
  return Response.json({ ...result, discovered: discovery.added.length, paused: discovery.paused }, { status: result.error ? 502 : 200 });
}
