import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isZohoConnected } from "@/lib/zoho/client";
import { pushOrderToZoho, recordZohoOrderSync } from "@/lib/zoho/orders";
import type { OrderStatus } from "@/lib/constants";

/**
 * PATCH /api/orders/[id]
 * Updates the status (and optionally admin_notes) of a WhatsApp order.
 * When status changes to "confirmed" and Zoho is connected, pushes a
 * Sales Order to Zoho Inventory to track the sale and decrement stock.
 * Protected — requires an authenticated admin session.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = params.id;
  let body: { status?: OrderStatus; admin_notes?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Build the update payload
  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.admin_notes !== undefined) updateData.admin_notes = body.admin_notes;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Update the order in Supabase
  const { error: updateError } = await adminSupabase
    .from("whatsapp_orders")
    .update(updateData)
    .eq("id", orderId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Record stock movement and push to Zoho when status changes to "confirmed"
  if (body.status === "confirmed") {
    // Decrement local stock and record movement
    try {
      const { data: orderForStock } = await adminSupabase
        .from("whatsapp_orders")
        .select("product_id, product_name, quantity")
        .eq("id", orderId)
        .single();

      if (orderForStock?.product_id) {
        const { data: prod } = await adminSupabase
          .from("products")
          .select("stock_quantity")
          .eq("id", orderForStock.product_id)
          .single();

        if (prod) {
          const newQty = Math.max(0, prod.stock_quantity - orderForStock.quantity);
          await adminSupabase
            .from("products")
            .update({ stock_quantity: newQty })
            .eq("id", orderForStock.product_id);

          await adminSupabase.from("stock_movements").insert({
            product_id: orderForStock.product_id,
            movement_type: "sale",
            quantity_change: -orderForStock.quantity,
            quantity_before: prod.stock_quantity,
            quantity_after: newQty,
            reference: orderId,
            notes: `Order confirmed: ${orderForStock.product_name}`,
            created_by: user.id,
          });
        }
      }
    } catch (stockErr) {
      console.error("[Inventory] Failed to record sale movement:", stockErr);
    }
    try {
      const connected = await isZohoConnected();
      if (connected) {
        // Fetch order details to build the Zoho payload
        const { data: order } = await adminSupabase
          .from("whatsapp_orders")
          .select("id, product_id, product_name, price, quantity, customer_phone, zoho_synced_at")
          .eq("id", orderId)
          .single();

        // Only push if not already synced to Zoho
        if (order && !order.zoho_synced_at) {
          // Look up zoho_item_id from products table if we have a product_id
          let zohoItemId: string | null = null;
          if (order.product_id) {
            const { data: prod } = await adminSupabase
              .from("products")
              .select("zoho_item_id")
              .eq("id", order.product_id)
              .maybeSingle();
            zohoItemId = prod?.zoho_item_id ?? null;
          }

          try {
            const { zohoSalesOrderId } = await pushOrderToZoho({
              whatsappOrderId: order.id,
              productName: order.product_name,
              price: order.price,
              quantity: order.quantity,
              zohoItemId,
              customerPhone: order.customer_phone,
            });
            await recordZohoOrderSync(order.id, { zohoSalesOrderId });
          } catch (zohoErr) {
            const errMsg =
              zohoErr instanceof Error ? zohoErr.message : String(zohoErr);
            await recordZohoOrderSync(order.id, { error: errMsg });
            // Don't fail the request — status update succeeded, Zoho push is secondary
            console.error("[Zoho] Order push failed:", errMsg);
          }
        }
      }
    } catch (connErr) {
      // Zoho connectivity check failure should not block the status update
      console.error("[Zoho] Connection check failed:", connErr);
    }
  }

  return NextResponse.json({ ok: true });
}
