import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncProductsFromZoho } from "@/lib/zoho/sync";

export const maxDuration = 60;

/**
 * POST /api/zoho/sync
 * Triggers a full product sync from Zoho Inventory → Kaira Enterprises.
 * Protected — requires an authenticated admin session.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncProductsFromZoho();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
