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
// Auto-categorization helpers
// ---------------------------------------------------------------------------

type CategoryMap = Map<string, { id: string; name: string }>;

/** Builds a lookup map of lowercase category name → { id, name } */
async function loadCategoryMap(
  supabase: ReturnType<typeof createAdminClient>
): Promise<CategoryMap> {
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");
  const map: CategoryMap = new Map();
  for (const cat of data ?? []) {
    map.set(cat.name.toLowerCase(), { id: cat.id, name: cat.name });
  }
  return map;
}

/** Generate a category slug from a name */
function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves a category_id for a Zoho item.
 * 1. Uses group_name or category_name from Zoho as the category label.
 * 2. Matches against existing categories (case-insensitive).
 * 3. Creates a new category if no match is found.
 * Returns the category_id or null if no category info is available.
 */
async function resolveCategory(
  item: ZohoItem,
  categoryMap: CategoryMap,
  supabase: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  // Prefer group_name, fall back to category_name
  const rawLabel = (item.group_name || item.category_name || "").trim();
  if (!rawLabel) return null;

  const key = rawLabel.toLowerCase();

  // Check if category already exists
  const existing = categoryMap.get(key);
  if (existing) return existing.id;

  // Create new category
  const slug = categorySlug(rawLabel);
  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      name: rawLabel,
      slug,
      sort_order: categoryMap.size + 1,
    })
    .select("id, name")
    .single();

  if (error || !created) return null;

  // Update the in-memory map so subsequent items can find it
  categoryMap.set(key, { id: created.id, name: created.name });
  return created.id;
}

/** Loads all existing products that have a zoho_item_id, keyed by zoho_item_id */
async function loadExistingProductsByZohoId(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, { id: string; category_id: string | null }>> {
  const map = new Map<string, { id: string; category_id: string | null }>();
  const { data } = await supabase
    .from("products")
    .select("id, zoho_item_id, category_id")
    .not("zoho_item_id", "is", null);
  for (const row of data ?? []) {
    map.set(row.zoho_item_id, { id: row.id, category_id: row.category_id });
  }
  return map;
}

/** Deletes all categories that have zero products assigned to them. */
async function deleteEmptyCategories(
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  // Fetch all categories
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id");
  if (!allCategories?.length) return 0;

  // Fetch distinct category_ids that are in use
  const { data: usedRows } = await supabase
    .from("products")
    .select("category_id")
    .not("category_id", "is", null);

  const usedIds = new Set((usedRows ?? []).map((r) => r.category_id));

  const emptyIds = allCategories
    .map((c) => c.id)
    .filter((id) => !usedIds.has(id));

  if (emptyIds.length === 0) return 0;

  const { error } = await supabase
    .from("categories")
    .delete()
    .in("id", emptyIds);

  return error ? 0 : emptyIds.length;
}

// ---------------------------------------------------------------------------
// Public sync functions
// ---------------------------------------------------------------------------

/**
 * Full sync: fetches all items from Zoho and upserts them into the products table.
 * Existing products are updated (Zoho-owned fields only).
 * New items create new product rows with an auto-generated slug and auto-assigned category.
 * After sync, empty categories are cleaned up.
 *
 * Optimized for Vercel's 60-second function timeout by batching DB operations
 * instead of making individual queries per product.
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

    // Load categories and existing products in parallel
    const [categoryMap, existingProducts] = await Promise.all([
      loadCategoryMap(supabase),
      loadExistingProductsByZohoId(supabase),
    ]);

    // Resolve all categories first (only creates new ones as needed)
    const categoryIds = new Map<string, string | null>();
    for (const item of items) {
      const categoryId = await resolveCategory(item, categoryMap, supabase);
      categoryIds.set(item.item_id, categoryId);
    }

    // Separate items into batches for update and insert
    const toUpdate: Record<string, unknown>[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (const item of items) {
      try {
        const productData = mapZohoItemToProduct(item);
        const existing = existingProducts.get(item.item_id);
        const categoryId = categoryIds.get(item.item_id) ?? null;

        if (existing) {
          toUpdate.push({
            id: existing.id,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            compare_at_price: productData.compare_at_price,
            sku: productData.sku,
            stock_quantity: productData.stock_quantity,
            is_active: productData.is_active,
            last_synced_from_zoho: productData.last_synced_from_zoho,
            zoho_item_id: item.item_id,
            // Only assign category if product is uncategorized
            ...(!existing.category_id && categoryId
              ? { category_id: categoryId }
              : {}),
          });
        } else {
          const slug = generateSlug(item.name, item.item_id);
          toInsert.push({
            ...productData,
            slug,
            ...(categoryId ? { category_id: categoryId } : {}),
          });
        }
      } catch (itemErr) {
        const msg =
          itemErr instanceof Error ? itemErr.message : String(itemErr);
        result.errors.push(`Item ${item.item_id}: ${msg}`);
      }
    }

    // Batch upsert existing products (uses id as conflict target to update)
    const BATCH_SIZE = 50;
    if (toUpdate.length > 0) {
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("products")
          .upsert(batch, { onConflict: "id" });
        if (error) {
          result.errors.push(`Batch update error: ${error.message}`);
        } else {
          result.updated += batch.length;
        }
      }
    }

    // Batch insert new products
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("products").insert(batch);
        if (error) {
          result.errors.push(`Batch insert error: ${error.message}`);
        } else {
          result.created += batch.length;
        }
      }
    }

    // Clean up empty categories after sync
    const deletedCount = await deleteEmptyCategories(supabase);
    result.categories_deleted = deletedCount;

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
  const categoryMap = await loadCategoryMap(supabase);

  const { data: existing } = await supabase
    .from("products")
    .select("id, category_id")
    .eq("zoho_item_id", zohoItemId)
    .maybeSingle();

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      name: productData.name,
      description: productData.description,
      price: productData.price,
      compare_at_price: productData.compare_at_price,
      sku: productData.sku,
      stock_quantity: productData.stock_quantity,
      is_active: productData.is_active,
      last_synced_from_zoho: productData.last_synced_from_zoho,
    };

    // Auto-assign category if product is uncategorized
    if (!existing.category_id) {
      const categoryId = await resolveCategory(item, categoryMap, supabase);
      if (categoryId) {
        updatePayload.category_id = categoryId;
      }
    }

    await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", existing.id);
  } else {
    const categoryId = await resolveCategory(item, categoryMap, supabase);
    const slug = generateSlug(item.name, item.item_id);
    await supabase.from("products").insert({
      ...productData,
      slug,
      ...(categoryId ? { category_id: categoryId } : {}),
    });
  }
}
