import { createAdminClient } from "@/lib/supabase/admin";
import { zohoFetch } from "./client";
import type { ZohoItem, ZohoItemsResponse, ZohoItemResponse, SyncResult } from "./types";

// ---------------------------------------------------------------------------
// Field mapping: Zoho item → Kaira Enterprises product columns
// ---------------------------------------------------------------------------

/**
 * Maps a Zoho item to the Kaira Enterprises product fields that Zoho "owns".
 * Fields like slug, category_id, brand, age_range, tags, is_featured
 * remain under Kaira Enterprises admin control and are NOT overwritten on sync.
 */
export function mapZohoItemToProduct(item: ZohoItem) {
  // compare_at_price comes from a Zoho custom field labeled "Compare At Price"
  // The label must exactly match what is configured in your Zoho account.
  const compareAtField = item.custom_fields?.find(
    (f) => f.label === "Compare At Price"
  );
  const compare_at_price =
    compareAtField?.value != null && compareAtField.value !== ""
      ? Number(compareAtField.value)
      : null;

  return {
    name: item.name,
    description: item.description ?? null,
    price: item.rate,
    compare_at_price,
    sku: item.sku ?? null,
    stock_quantity: item.actual_available_stock ?? 0,
    zoho_item_id: item.item_id,
    last_synced_from_zoho: new Date().toISOString(),
    is_active: item.status === "active",
  };
}

/** Generates a URL-safe slug. Appends last 6 chars of item_id for uniqueness. */
function generateSlug(name: string, itemId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${itemId.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchAllZohoItems(): Promise<ZohoItem[]> {
  const allItems: ZohoItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await zohoFetch(`/items?page=${page}&per_page=200`);
    const body = await res.text();

    if (!res.ok) {
      throw new Error(`Zoho items fetch failed (page ${page}, ${res.status}): ${body.slice(0, 300)}`);
    }

    let json: ZohoItemsResponse;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(
        `Zoho returned invalid JSON (page ${page}, ${res.status}): ${body.slice(0, 300)}`
      );
    }

    if (json.code !== 0) {
      throw new Error(`Zoho API error ${json.code}: ${json.message}`);
    }

    allItems.push(...json.items);
    hasMore = json.page_context?.has_more_page ?? false;
    page++;
  }

  return allItems;
}

// ---------------------------------------------------------------------------
// Sync status helpers
// ---------------------------------------------------------------------------

async function setSyncStatus(status: string, error = "") {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const rows = [
    { key: "zoho_sync_status", value: status, updated_at: now },
    { key: "zoho_sync_error", value: error, updated_at: now },
  ];
  for (const row of rows) {
    await supabase.from("store_settings").upsert(row, { onConflict: "key" });
  }
}

async function setLastSyncAt() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  await supabase.from("store_settings").upsert(
    { key: "zoho_last_sync_at", value: now, updated_at: now },
    { onConflict: "key" }
  );
}

// ---------------------------------------------------------------------------
// Public sync functions
// ---------------------------------------------------------------------------

/**
 * Full sync: fetches all items from Zoho and upserts them into the products table.
 * Existing products are updated (Zoho-owned fields only).
 * New items create new product rows with an auto-generated slug.
 */
export async function syncProductsFromZoho(): Promise<SyncResult> {
  const result: SyncResult = {
    total: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  await setSyncStatus("syncing");
  const supabase = createAdminClient();

  try {
    const items = await fetchAllZohoItems();
    result.total = items.length;

    for (const item of items) {
      try {
        const productData = mapZohoItemToProduct(item);

        const { data: existing } = await supabase
          .from("products")
          .select("id, slug")
          .eq("zoho_item_id", item.item_id)
          .maybeSingle();

        if (existing) {
          // Update only Zoho-owned fields; leave slug, category, etc. untouched
          await supabase
            .from("products")
            .update({
              name: productData.name,
              description: productData.description,
              price: productData.price,
              compare_at_price: productData.compare_at_price,
              sku: productData.sku,
              stock_quantity: productData.stock_quantity,
              is_active: productData.is_active,
              last_synced_from_zoho: productData.last_synced_from_zoho,
            })
            .eq("id", existing.id);
          result.updated++;
        } else {
          const slug = generateSlug(item.name, item.item_id);
          const { error: insertError } = await supabase
            .from("products")
            .insert({ ...productData, slug });
          if (insertError) {
            result.errors.push(
              `Failed to insert "${item.name}": ${insertError.message}`
            );
          } else {
            result.created++;
          }
        }
      } catch (itemErr) {
        const msg =
          itemErr instanceof Error ? itemErr.message : String(itemErr);
        result.errors.push(`Item ${item.item_id}: ${msg}`);
      }
    }

    await setLastSyncAt();
    await setSyncStatus("idle");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setSyncStatus("error", msg);
    result.errors.push(msg);
  }

  return result;
}

/**
 * Syncs a single Zoho item by item_id.
 * Used by the webhook handler for real-time updates.
 */
export async function syncSingleItemFromZoho(zohoItemId: string): Promise<void> {
  const res = await zohoFetch(`/items/${zohoItemId}`);
  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `Could not fetch Zoho item ${zohoItemId} (${res.status}): ${body.slice(0, 300)}`
    );
  }

  let json: ZohoItemResponse;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(
      `Zoho returned invalid JSON for item ${zohoItemId}: ${body.slice(0, 300)}`
    );
  }
  if (json.code !== 0) {
    throw new Error(`Zoho API error ${json.code}: ${json.message}`);
  }

  const item = json.item;
  const productData = mapZohoItemToProduct(item);
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("zoho_item_id", zohoItemId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("products")
      .update({
        name: productData.name,
        description: productData.description,
        price: productData.price,
        compare_at_price: productData.compare_at_price,
        sku: productData.sku,
        stock_quantity: productData.stock_quantity,
        is_active: productData.is_active,
        last_synced_from_zoho: productData.last_synced_from_zoho,
      })
      .eq("id", existing.id);
  } else {
    const slug = generateSlug(item.name, item.item_id);
    await supabase.from("products").insert({ ...productData, slug });
  }
}
