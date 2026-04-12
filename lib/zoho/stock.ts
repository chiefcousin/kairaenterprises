import { zohoFetch } from "./client";

/**
 * Pushes a stock quantity update to Zoho Inventory for a specific item.
 * Uses the Inventory Adjustment API to set the new stock level.
 */
export async function pushStockToZoho(
  zohoItemId: string,
  newQuantity: number
): Promise<void> {
  // Fetch current Zoho stock to calculate the adjustment
  const itemRes = await zohoFetch(`/items/${zohoItemId}`);
  if (!itemRes.ok) {
    const body = await itemRes.text();
    throw new Error(`Failed to fetch Zoho item ${zohoItemId}: ${body.slice(0, 300)}`);
  }

  const itemJson = await itemRes.json();
  if (itemJson.code !== 0) {
    throw new Error(`Zoho API error: ${itemJson.message}`);
  }

  const currentStock = Math.round(itemJson.item?.actual_available_stock ?? 0);
  const difference = newQuantity - currentStock;

  if (difference === 0) return; // No change needed

  // Create an inventory adjustment
  const adjustmentPayload = {
    date: new Date().toISOString().split("T")[0],
    reason: "Stock updated from Kaira Enterprises",
    description: `Synced stock: ${currentStock} → ${newQuantity}`,
    adjustment_type: difference > 0 ? "quantity" : "quantity",
    line_items: [
      {
        item_id: zohoItemId,
        quantity_adjusted: Math.abs(difference),
        adjustment_type: difference > 0 ? "increase" : "decrease",
      },
    ],
  };

  const res = await zohoFetch("/inventoryadjustments", {
    method: "POST",
    body: JSON.stringify(adjustmentPayload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Zoho inventory adjustment failed (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`Zoho adjustment error ${json.code}: ${json.message}`);
  }
}
