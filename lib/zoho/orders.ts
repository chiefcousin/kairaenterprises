import { createAdminClient } from "@/lib/supabase/admin";
import { zohoFetch } from "./client";
import type {
  ZohoCreateSalesOrderPayload,
  ZohoCreateSalesOrderResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Push a Kaira Enterprises order to Zoho Inventory as a Sales Order
// ---------------------------------------------------------------------------

interface OrderData {
  whatsappOrderId: string;
  productName: string;
  price: number;
  quantity: number;
  zohoItemId?: string | null; // links to Zoho item for stock tracking
  customerPhone?: string | null;
}

/**
 * Creates a Sales Order in Zoho Inventory for a confirmed WhatsApp order.
 * Returns the Zoho sales order ID and number on success.
 */
export async function pushOrderToZoho(order: OrderData): Promise<{
  zohoSalesOrderId: string;
  zohoSalesOrderNumber: string;
}> {
  const payload: ZohoCreateSalesOrderPayload = {
    customer_name: order.customerPhone
      ? `WhatsApp ${order.customerPhone}`
      : "WhatsApp Customer",
    reference_number: order.whatsappOrderId,
    notes: `Kaira Enterprises WhatsApp order. ID: ${order.whatsappOrderId}`,
    line_items: [
      {
        name: order.productName,
        rate: order.price,
        quantity: order.quantity,
        unit: "pcs",
        ...(order.zohoItemId ? { item_id: order.zohoItemId } : {}),
      },
    ],
  };

  // zohoFetch handles the JSONString form-encoding automatically
  const res = await zohoFetch("/salesorders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho sales order creation failed (${res.status}): ${body}`);
  }

  const json: ZohoCreateSalesOrderResponse = await res.json();

  if (json.code !== 0) {
    throw new Error(`Zoho error ${json.code}: ${json.message}`);
  }

  if (!json.salesorder) {
    throw new Error("Zoho returned no salesorder in response");
  }

  return {
    zohoSalesOrderId: json.salesorder.salesorder_id,
    zohoSalesOrderNumber: json.salesorder.salesorder_number,
  };
}

/**
 * Records the result (success or error) of a Zoho sync back onto the
 * whatsapp_orders row so admins can see sync status in the orders table.
 */
export async function recordZohoOrderSync(
  whatsappOrderId: string,
  result: { zohoSalesOrderId?: string; error?: string }
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("whatsapp_orders")
    .update({
      zoho_sales_order_id: result.zohoSalesOrderId ?? null,
      zoho_sync_error: result.error ?? null,
      zoho_synced_at: new Date().toISOString(),
    })
    .eq("id", whatsappOrderId);
}
