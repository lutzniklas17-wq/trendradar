import { cronClient } from "@/lib/cron";
import { isJob, runJob } from "@/lib/collect/jobs";

// Tägliche Datensammler (Vercel Cron, siehe vercel.json): /api/cron/collect?job=ads|producthunt|rss
export const maxDuration = 300;

export async function GET(request: Request) {
  const job = new URL(request.url).searchParams.get("job");
  if (!isJob(job)) return Response.json({ error: "Unbekannter Sammler." }, { status: 400 });
  const auth = cronClient(request);
  if ("response" in auth) return auth.response;
  const result = await runJob(auth.supabase, job);
  return Response.json(result, { status: result.status === "failed" ? 502 : 200 });
}
