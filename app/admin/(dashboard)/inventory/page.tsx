"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/components/admin/role-context";
import type { Product } from "@/lib/types";

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();
  const supabase = createClient();
  const role = useUserRole();
  const canEdit = role === "admin" || role === "partner";

  async function fetchProducts() {
    let query = supabase
      .from("products")
      .select("id, name, sku, stock_quantity, is_active")
      .order("stock_quantity", { ascending: true });

    if (filter === "out") {
      query = query.eq("stock_quantity", 0);
    } else if (filter === "low") {
      query = query.gt("stock_quantity", 0).lte("stock_quantity", 5);
    }

    const { data } = await query;
    setProducts((data as Product[]) || []);
  }

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function updateStock(productId: string, quantity: number) {
    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: Math.max(0, quantity) })
      .eq("id", productId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Stock quantity updated" });
    }
  }

  function stockBadge(qty: number) {
    if (qty === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (qty <= 5) return <Badge className="bg-yellow-100 text-yellow-700">Low Stock</Badge>;
    return <Badge className="bg-green-100 text-green-700">In Stock</Badge>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inventory</h1>

      <div className="flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "low", label: "Low Stock" },
          { key: "out", label: "Out of Stock" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{product.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {product.sku || "—"}
                </td>
                <td className="px-4 py-3">
                  {stockBadge(product.stock_quantity)}
                </td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <Input
                      type="number"
                      min="0"
                      defaultValue={product.stock_quantity}
                      className="h-8 w-24"
                      onBlur={(e) =>
                        updateStock(product.id, parseInt(e.target.value, 10))
                      }
                    />
                  ) : (
                    <span>{product.stock_quantity}</span>
                  )}
                </td>
              </tr>
            ))}
            {!products.length && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
