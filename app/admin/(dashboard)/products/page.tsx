import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/whatsapp";
import { ProductActions, AddProductButton, BulkImportButton } from "@/components/admin/product-actions";
import type { ProductWithPrimaryImage } from "@/lib/types";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";

interface ProductRow extends ProductWithPrimaryImage {
  is_featured: boolean;
  is_active: boolean;
  sku: string | null;
  stock_quantity: number;
}

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();
  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Fetch counts and paginated products in parallel
  const [
    { count: totalCount },
    { count: activeCount },
    { count: outOfStockCount },
    { data: products },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("stock_quantity", 0),
    supabase
      .from("products")
      .select("*, product_images(url, alt_text), categories(name, slug)")
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  const total = totalCount ?? 0;
  const active = activeCount ?? 0;
  const draft = total - active;
  const outOfStock = outOfStockCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          <BulkImportButton />
          <AddProductButton />
        </div>
      </div>

      {/* Product counts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-green-600">{active}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Draft</p>
          <p className="text-2xl font-bold text-muted-foreground">{draft}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Price</th>
                <th className="px-4 py-3 text-left font-medium">Stock</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((product: ProductRow) => {
                const img = product.product_images?.[0];
                return (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {img ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded">
                            <Image
                              src={img.url}
                              alt={img.alt_text || product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs">
                            ?
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground">
                              SKU: {product.sku}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.categories?.name || "—"}
                    </td>
                    <td className="px-4 py-3">{formatPrice(product.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          product.stock_quantity === 0
                            ? "text-red-600"
                            : product.stock_quantity <= 5
                            ? "text-yellow-600"
                            : ""
                        }
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={product.is_active ? "default" : "secondary"}
                      >
                        {product.is_active ? "Active" : "Draft"}
                      </Badge>
                      {product.is_featured && (
                        <Badge variant="outline" className="ml-1">
                          Featured
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ProductActions
                        productId={product.id}
                        productName={product.name}
                      />
                    </td>
                  </tr>
                );
              })}
              {!products?.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8" />
                      No products yet. Add your first product!
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total} products
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                asChild={currentPage > 1}
              >
                {currentPage > 1 ? (
                  <Link href={`/admin/products?page=${currentPage - 1}`}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </span>
                )}
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  // Show first, last, current, and neighbors
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - currentPage) <= 1) return true;
                  return false;
                })
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === currentPage ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild={p !== currentPage}
                    >
                      {p === currentPage ? (
                        <span>{p}</span>
                      ) : (
                        <Link href={`/admin/products?page=${p}`}>{p}</Link>
                      )}
                    </Button>
                  )
                )}

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                asChild={currentPage < totalPages}
              >
                {currentPage < totalPages ? (
                  <Link href={`/admin/products?page=${currentPage + 1}`}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
