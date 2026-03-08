import { createAdminClient } from "@/lib/supabase/admin";
import { zohoFetch } from "./client";
import type { ZohoItem, ZohoItemsResponse, ZohoItemResponse, SyncResult } from "./types";

/** Time budget: stop processing if we've used more than 50s of the 60s limit */
const TIME_BUDGET_MS = 50_000;

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
    stock_quantity: Math.round(item.actual_available_stock ?? 0),
    zoho_item_id: item.item_id,
    last_synced_from_zoho: new Date().toISOString(),
    is_active: item.status === "active",
  };
}

/** Generates a URL-safe slug. Appends the full item_id for guaranteed uniqueness. */
function generateSlug(name: string, itemId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${itemId}`;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Fetches one page of Zoho items. Returns items and whether more pages exist. */
async function fetchZohoItemsPage(page: number): Promise<{
  items: ZohoItem[];
  hasMore: boolean;
}> {
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

  return {
    items: json.items,
    hasMore: json.page_context?.has_more_page ?? false,
  };
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

/** Loads all existing products that have a zoho_item_id, keyed by zoho_item_id.
 *  Paginates past Supabase's default 1000-row limit. */
async function loadExistingProductsByZohoId(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, { id: string; slug: string; category_id: string | null }>> {
  const map = new Map<string, { id: string; slug: string; category_id: string | null }>();
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data } = await supabase
      .from("products")
      .select("id, zoho_item_id, slug, category_id")
      .not("zoho_item_id", "is", null)
      .range(from, from + PAGE_SIZE - 1);

    if (!data || data.length === 0) break;

    for (const row of data) {
      map.set(row.zoho_item_id, { id: row.id, slug: row.slug, category_id: row.category_id });
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return map;
}

/** Loads all existing product slugs to prevent duplicates on insert. */
async function loadAllSlugs(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  const slugs = new Set<string>();
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data } = await supabase
      .from("products")
      .select("slug")
      .range(from, from + PAGE_SIZE - 1);

    if (!data || data.length === 0) break;
    for (const row of data) slugs.add(row.slug);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return slugs;
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
 * Processes a batch of Zoho items: resolves categories and prepares upsert/insert rows.
 * Returns the rows separated into updates and inserts.
 */
function processItemBatch(
  items: ZohoItem[],
  existingProducts: Map<string, { id: string; slug: string; category_id: string | null }>,
  existingSlugs: Set<string>,
  categoryMap: CategoryMap,
  errors: string[]
): {
  toUpdate: Record<string, unknown>[];
  toInsert: Record<string, unknown>[];
} {
  const toUpdate: Record<string, unknown>[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (const item of items) {
    try {
      const productData = mapZohoItemToProduct(item);

      // Resolve category synchronously from the in-memory map
      const rawLabel = (item.group_name || item.category_name || "").trim();
      const catKey = rawLabel ? rawLabel.toLowerCase() : "";
      const existingCat = catKey ? categoryMap.get(catKey) : undefined;
      const categoryId = existingCat?.id ?? null;

      const existing = existingProducts.get(item.item_id);

      if (existing) {
        // Update: include the existing slug so upsert doesn't violate NOT NULL
        toUpdate.push({
          id: existing.id,
          slug: existing.slug,
          name: productData.name,
          description: productData.description,
          price: productData.price,
          compare_at_price: productData.compare_at_price,
          sku: productData.sku,
          stock_quantity: productData.stock_quantity,
          is_active: productData.is_active,
          last_synced_from_zoho: productData.last_synced_from_zoho,
          zoho_item_id: item.item_id,
          ...(!existing.category_id && categoryId
            ? { category_id: categoryId }
            : {}),
        });
      } else {
        // New product: generate a unique slug
        let slug = generateSlug(item.name, item.item_id);
        let suffix = 2;
        while (existingSlugs.has(slug)) {
          slug = `${generateSlug(item.name, item.item_id)}-${suffix}`;
          suffix++;
        }
        existingSlugs.add(slug);

        toInsert.push({
          ...productData,
          slug,
          ...(categoryId ? { category_id: categoryId } : {}),
        });
      }
    } catch (itemErr) {
      const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
      errors.push(`Item ${item.item_id}: ${msg}`);
    }
  }

  return { toUpdate, toInsert };
}

/**
 * Full sync: fetches items from Zoho page-by-page and upserts them into the
 * products table. Processes each page immediately to avoid holding all data in
 * memory and to stay within Vercel's 60-second function timeout.
 *
 * Uses a 50-second time budget — stops fetching new pages when time runs low
 * so we can still persist the results we have.
 */
export async function syncProductsFromZoho(): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    total: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  await setSyncStatus("syncing");
  const supabase = createAdminClient();

  try {
    // Load categories, existing products, and all slugs in parallel
    const [categoryMap, existingProducts, existingSlugs] = await Promise.all([
      loadCategoryMap(supabase),
      loadExistingProductsByZohoId(supabase),
      loadAllSlugs(supabase),
    ]);

    // Process page by page — fetch, transform, write, then next page
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      // Check time budget before fetching the next page
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        result.errors.push(
          `Stopped after page ${page - 1}: approaching timeout. Run sync again to continue.`
        );
        break;
      }

      const pageResult = await fetchZohoItemsPage(page);
      const items = pageResult.items;
      hasMore = pageResult.hasMore;
      result.total += items.length;

      // Create any new categories needed by this page's items (batch)
      const uniqueNewCats = new Map<string, string>();
      for (const item of items) {
        const rawLabel = (item.group_name || item.category_name || "").trim();
        if (!rawLabel) continue;
        const key = rawLabel.toLowerCase();
        if (!categoryMap.has(key) && !uniqueNewCats.has(key)) {
          uniqueNewCats.set(key, rawLabel);
        }
      }

      // Insert all new categories in one batch
      if (uniqueNewCats.size > 0) {
        const catRows = Array.from(uniqueNewCats.entries()).map(
          ([, rawLabel], idx) => ({
            name: rawLabel,
            slug: categorySlug(rawLabel),
            sort_order: categoryMap.size + idx + 1,
          })
        );
        const { data: created } = await supabase
          .from("categories")
          .upsert(catRows, { onConflict: "slug" })
          .select("id, name");
        for (const cat of created ?? []) {
          categoryMap.set(cat.name.toLowerCase(), {
            id: cat.id,
            name: cat.name,
          });
        }
      }

      // Process items into update/insert rows
      const { toUpdate, toInsert } = processItemBatch(
        items,
        existingProducts,
        existingSlugs,
        categoryMap,
        result.errors
      );

      // Write updates in one batch
      if (toUpdate.length > 0) {
        const { error } = await supabase
          .from("products")
          .upsert(toUpdate, { onConflict: "id" });
        if (error) {
          result.errors.push(`Page ${page} update error: ${error.message}`);
        } else {
          result.updated += toUpdate.length;
        }
      }

      // Write inserts in one batch
      if (toInsert.length > 0) {
        const { error } = await supabase.from("products").insert(toInsert);
        if (error) {
          result.errors.push(`Page ${page} insert error: ${error.message}`);
        } else {
          result.created += toInsert.length;
        }
      }

      page++;
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
