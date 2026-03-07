import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/whatsapp";
import { ProductActions, AddProductButton, BulkImportButton } from "@/components/admin/product-actions";
import type { ProductWithPrimaryImage } from "@/lib/types";

interface ProductRow extends ProductWithPrimaryImage {
  is_featured: boolean;
  is_active: boolean;
  sku: string | null;
  stock_quantity: number;
}

export default async function AdminProductsPage() {
  const supabase = createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, product_images(url, alt_text), categories(name, slug)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          <BulkImportButton />
          <AddProductButton />
        </div>
      </div>

      <div className="rounded-lg border bg-white">
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
                    No products yet. Add your first product!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
