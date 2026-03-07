import { createClient } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/storefront/product-grid";
import { FilterSidebar, ActiveFilters } from "@/components/storefront/filter-sidebar";
import { SortSelect } from "@/components/storefront/sort-select";
import { PRODUCT_PAGE_SIZE } from "@/lib/constants";
import type { Metadata } from "next";
import type { ProductWithPrimaryImage } from "@/lib/types";

export const metadata: Metadata = {
  title: "All Toys",
  description: "Browse our complete toy collection",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = createClient();

  const category = searchParams.category as string | undefined;
  const age_range = searchParams.age_range as string | undefined;
  const brand = searchParams.brand as string | undefined;
  const min_price = searchParams.min_price as string | undefined;
  const max_price = searchParams.max_price as string | undefined;
  const in_stock = searchParams.in_stock as string | undefined;
  const on_sale = searchParams.on_sale as string | undefined;
  const is_featured = searchParams.is_featured as string | undefined;
  const sort = (searchParams.sort as string) || "newest";
  const page = parseInt((searchParams.page as string) || "1", 10);

  let query = supabase
    .from("products")
    .select("*, product_images(url, alt_text), categories(name, slug)", {
      count: "exact",
    })
    .eq("is_active", true);

  if (category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .single();
    if (cat) query = query.eq("category_id", cat.id);
  }

  if (age_range) query = query.eq("age_range", age_range);
  if (brand) query = query.ilike("brand", brand);
  if (min_price) query = query.gte("price", parseFloat(min_price));
  if (max_price) query = query.lte("price", parseFloat(max_price));
  if (in_stock === "true") query = query.gt("stock_quantity", 0);
  if (on_sale === "true") query = query.not("compare_at_price", "is", null);
  if (is_featured === "true") query = query.eq("is_featured", true);

  // Sorting
  switch (sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "discount":
      // Products with biggest discount first (compare_at_price - price desc)
      // Supabase doesn't support computed column ordering, so we sort by
      // compare_at_price desc and then price asc as a proxy
      query = query
        .not("compare_at_price", "is", null)
        .order("compare_at_price", { ascending: false })
        .order("price", { ascending: true });
      break;
    case "bestsellers":
      // Order by number of confirmed orders. We use a secondary query below.
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  // Pagination
  const from = (page - 1) * PRODUCT_PAGE_SIZE;
  query = query.range(from, from + PRODUCT_PAGE_SIZE - 1);

  const { data: products, count } = await query;

  // For bestseller sort: fetch order counts and re-sort client-side
  let sortedProducts = products || [];
  if (sort === "bestsellers" && sortedProducts.length > 0) {
    const productIds = sortedProducts.map((p) => p.id);
    const { data: orderCounts } = await supabase
      .from("whatsapp_orders")
      .select("product_id")
      .in("product_id", productIds)
      .in("status", ["confirmed", "fulfilled"]);

    const countMap: Record<string, number> = {};
    orderCounts?.forEach((o) => {
      countMap[o.product_id] = (countMap[o.product_id] || 0) + 1;
    });

    sortedProducts = [...sortedProducts].sort(
      (a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0)
    );
  }

  const totalPages = Math.ceil((count || 0) / PRODUCT_PAGE_SIZE);

  // Fetch filter options
  const { data: brands } = await supabase
    .from("products")
    .select("brand")
    .eq("is_active", true)
    .not("brand", "is", null);
  const uniqueBrands = Array.from(
    new Set(brands?.map((b) => b.brand).filter(Boolean))
  );

  const { data: categories } = await supabase
    .from("categories")
    .select("name, slug")
    .order("sort_order");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">All Toys</h1>
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-60">
          <FilterSidebar
            categories={categories || []}
            brands={uniqueBrands as string[]}
            currentFilters={searchParams as Record<string, string>}
          />
        </aside>
        <div className="flex-1">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {count || 0} product{count !== 1 ? "s" : ""} found
            </p>
            <SortSelect current={sort} />
          </div>
          <div className="mb-4">
            <ActiveFilters
              currentFilters={searchParams as Record<string, string>}
            />
          </div>
          <ProductGrid
            products={sortedProducts as unknown as ProductWithPrimaryImage[]}
            emptyMessage="No products match your filters"
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={searchParams as Record<string, string>}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string>;
}) {
  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `/products?${params.toString()}`;
  }

  return (
    <div className="mt-8 flex justify-center gap-2">
      {currentPage > 1 && (
        <a
          href={buildUrl(currentPage - 1)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Previous
        </a>
      )}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <a
          key={p}
          href={buildUrl(p)}
          className={`rounded-md border px-3 py-2 text-sm ${
            p === currentPage
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          {p}
        </a>
      ))}
      {currentPage < totalPages && (
        <a
          href={buildUrl(currentPage + 1)}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Next
        </a>
      )}
    </div>
  );
}
