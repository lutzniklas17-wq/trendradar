"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";

/** Alle Inbox-Einträge als gelesen markieren. */
export async function markAllRead() {
  const { supabase } = await requireOwner();
  await supabase.from("inbox_entries").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/inbox");
}
