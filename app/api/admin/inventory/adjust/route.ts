import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isZohoConnected } from "@/lib/zoho/client";
import { pushStockToZoho } from "@/lib/zoho/stock";
import type { StockMovementType } from "@/lib/types";

/**
 * POST /api/admin/inventory/adjust
 * Records a stock adjustment with full audit trail.
 * Optionally pushes the change to Zoho if connected.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    product_id: string;
    movement_type: StockMovementType;
    quantity_change: number;
    notes?: string;
    reference?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { product_id, movement_type, quantity_change, notes, reference } = body;

  if (!product_id || !movement_type || quantity_change === undefined) {
    return NextResponse.json(
      { error: "product_id, movement_type, and quantity_change are required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Fetch current stock
  const { data: product, error: fetchErr } = await adminSupabase
    .from("products")
    .select("id, stock_quantity, zoho_item_id, name")
    .eq("id", product_id)
    .single();

  if (fetchErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const quantityBefore = product.stock_quantity;
  const quantityAfter = Math.max(0, quantityBefore + quantity_change);

  // Update product stock
  const { error: updateErr } = await adminSupabase
    .from("products")
    .update({ stock_quantity: quantityAfter })
    .eq("id", product_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Record the movement
  const { error: moveErr } = await adminSupabase
    .from("stock_movements")
    .insert({
      product_id,
      movement_type,
      quantity_change,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      notes: notes || null,
      reference: reference || null,
      created_by: user.id,
    });

  if (moveErr) {
    console.error("[Inventory] Failed to record stock movement:", moveErr.message);
  }

  // Push to Zoho if connected and not a sync-from-zoho movement
  if (movement_type !== "sync_zoho") {
    try {
      const connected = await isZohoConnected();
      if (connected && product.zoho_item_id) {
        await pushStockToZoho(product.zoho_item_id, quantityAfter);
      }
    } catch (err) {
      console.error("[Zoho] Stock push failed:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    quantity_before: quantityBefore,
    quantity_after: quantityAfter,
  });
}
