import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/inventory/movements?product_id=xxx&limit=50
 * Returns stock movement history with product details.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id") || null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase.rpc("get_recent_stock_movements", {
    result_limit: limit,
    product_filter: productId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ movements: data || [] });
}
