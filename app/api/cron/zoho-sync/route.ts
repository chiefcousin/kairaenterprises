import { NextRequest, NextResponse } from "next/server";
import { syncProductsFromZoho } from "@/lib/zoho/sync";
import { isZohoConnected } from "@/lib/zoho/client";

/**
 * GET /api/cron/zoho-sync
 *
 * Called by Vercel Cron to automatically sync products from Zoho Inventory.
 * Secured via CRON_SECRET header check.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connected = await isZohoConnected();
  if (!connected) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Zoho not connected" });
  }

  try {
    const result = await syncProductsFromZoho();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
