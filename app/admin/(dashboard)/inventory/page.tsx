"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/components/admin/role-context";
import { formatPrice } from "@/lib/whatsapp";
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Plus,
  Minus,
  RotateCcw,
  Truck,
  Trash2,
  History,
  Search,
} from "lucide-react";
import type { Product, StockMovementType, InventorySummary, StockMovementWithProduct } from "@/lib/types";

const MOVEMENT_TYPES: { value: StockMovementType; label: string; icon: typeof Plus }[] = [
  { value: "purchase", label: "Purchase / Restock", icon: Truck },
  { value: "sale", label: "Sale", icon: Minus },
  { value: "adjustment", label: "Adjustment (count correction)", icon: ArrowUpDown },
  { value: "return", label: "Customer Return", icon: RotateCcw },
  { value: "damage", label: "Damaged / Write-off", icon: Trash2 },
  { value: "initial", label: "Initial Stock Entry", icon: Plus },
];

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  sale: "Sale",
  adjustment: "Adjustment",
  return: "Return",
  damage: "Damage",
  sync_zoho: "Zoho Sync",
  sync_local: "Local Sync",
  initial: "Initial",
};

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<StockMovementWithProduct[]>([]);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovementType>("purchase");
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustRef, setAdjustRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [productMovements, setProductMovements] = useState<StockMovementWithProduct[]>([]);
  const { toast } = useToast();
  const supabase = createClient();
  const role = useUserRole();
  const canEdit = role === "admin" || role === "partner";

  const fetchProducts = useCallback(async () => {
    let query = supabase
      .from("products")
      .select("id, name, sku, stock_quantity, is_active, price, cost_price, low_stock_threshold, zoho_item_id")
      .order("stock_quantity", { ascending: true });

    if (filter === "out") {
      query = query.eq("stock_quantity", 0);
    } else if (filter === "low") {
      query = query.gt("stock_quantity", 0).lte("stock_quantity", 5);
    }

    const { data } = await query;
    setProducts((data as Product[]) || []);
  }, [filter, supabase]);

  async function fetchSummary() {
    try {
      const res = await fetch("/api/admin/inventory/summary");
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary);
      }
    } catch {
      // non-critical
    }
  }

  async function fetchMovements() {
    try {
      const res = await fetch("/api/admin/inventory/movements?limit=30");
      if (res.ok) {
        const json = await res.json();
        setMovements(json.movements || []);
      }
    } catch {
      // non-critical
    }
  }

  async function fetchProductMovements(productId: string) {
    try {
      const res = await fetch(`/api/admin/inventory/movements?product_id=${productId}&limit=50`);
      if (res.ok) {
        const json = await res.json();
        setProductMovements(json.movements || []);
      }
    } catch {
      setProductMovements([]);
    }
  }

  useEffect(() => {
    fetchProducts();
    fetchSummary();
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function openAdjustDialog(product: Product) {
    setAdjustProduct(product);
    setAdjustType("purchase");
    setAdjustQty(0);
    setAdjustNotes("");
    setAdjustRef("");
  }

  function openHistoryDialog(product: Product) {
    setHistoryProduct(product);
    fetchProductMovements(product.id);
  }

  async function submitAdjustment() {
    if (!adjustProduct || adjustQty === 0) return;

    setSubmitting(true);
    // For sale/damage types, quantity_change should be negative
    const isOutgoing = ["sale", "damage"].includes(adjustType);
    const quantityChange = isOutgoing ? -Math.abs(adjustQty) : Math.abs(adjustQty);

    try {
      const res = await fetch("/api/admin/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: adjustProduct.id,
          movement_type: adjustType,
          quantity_change: quantityChange,
          notes: adjustNotes || undefined,
          reference: adjustRef || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        toast({
          title: "Stock Updated",
          description: `${adjustProduct.name}: ${json.quantity_before} → ${json.quantity_after}`,
        });
        setAdjustProduct(null);
        fetchProducts();
        fetchSummary();
        fetchMovements();
      } else {
        const json = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: json.error || "Failed to adjust stock",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function quickUpdateStock(productId: string, newQuantity: number, productName: string) {
    // Find current quantity
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const diff = newQuantity - product.stock_quantity;
    if (diff === 0) return;

    try {
      const res = await fetch("/api/admin/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          movement_type: "adjustment",
          quantity_change: diff,
          notes: `Quick edit: ${product.stock_quantity} → ${newQuantity}`,
        }),
      });

      if (res.ok) {
        toast({ title: "Updated", description: `${productName} stock updated` });
        fetchSummary();
        fetchMovements();
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
  }

  function stockBadge(qty: number, threshold: number = 5) {
    if (qty === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (qty <= threshold) return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Low Stock</Badge>;
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">In Stock</Badge>;
  }

  function movementBadge(type: string) {
    const colors: Record<string, string> = {
      purchase: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      sale: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      adjustment: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      return: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      damage: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      sync_zoho: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      sync_local: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
      initial: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-700"}>
        {MOVEMENT_TYPE_LABELS[type] || type}
      </Badge>
    );
  }

  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : products;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Units
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_units.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                across {summary.total_products} products
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Stock Value (Retail)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(summary.total_stock_value)}</div>
              {summary.total_cost_value > 0 && (
                <p className="text-xs text-muted-foreground">
                  Cost: {formatPrice(summary.total_cost_value)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.low_stock_count}</div>
              <p className="text-xs text-muted-foreground">need restocking</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Out of Stock
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.out_of_stock_count}</div>
              <p className="text-xs text-muted-foreground">unavailable products</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          <TabsTrigger value="movements">Movement History</TabsTrigger>
        </TabsList>

        {/* Stock Levels Tab */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-64 pl-8"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">SKU</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Price</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.sku || "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      {stockBadge(product.stock_quantity, product.low_stock_threshold || 5)}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <Input
                          type="number"
                          min="0"
                          defaultValue={product.stock_quantity}
                          className="h-8 w-24"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val !== product.stock_quantity) {
                              quickUpdateStock(product.id, val, product.name);
                            }
                          }}
                        />
                      ) : (
                        <span>{product.stock_quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      {product.zoho_item_id ? (
                        <Badge variant="outline" className="text-xs">Zoho</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Local</Badge>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAdjustDialog(product)}
                            title="Stock adjustment"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHistoryDialog(product)}
                            title="View history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!filteredProducts.length && (
                  <tr>
                    <td
                      colSpan={canEdit ? 7 : 6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Movement History Tab */}
        <TabsContent value="movements" className="space-y-4">
          <div className="rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Change</th>
                  <th className="px-4 py-3 text-left font-medium">Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString()}{" "}
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{m.product_name}</td>
                    <td className="px-4 py-3">{movementBadge(m.movement_type)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          m.quantity_change > 0
                            ? "text-green-600"
                            : m.quantity_change < 0
                            ? "text-red-600"
                            : ""
                        }`}
                      >
                        {m.quantity_change > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {m.quantity_change > 0 ? "+" : ""}
                        {m.quantity_change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.quantity_before} &rarr; {m.quantity_after}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-48 truncate">
                      {m.notes || m.reference || "\u2014"}
                    </td>
                  </tr>
                ))}
                {!movements.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No stock movements recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={(open) => !open && setAdjustProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock Adjustment</DialogTitle>
          </DialogHeader>
          {adjustProduct && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{adjustProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Current stock: <strong>{adjustProduct.stock_quantity}</strong>
                  {adjustProduct.sku && ` | SKU: ${adjustProduct.sku}`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={adjustType} onValueChange={(v) => setAdjustType(v as StockMovementType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Quantity {["sale", "damage"].includes(adjustType) ? "(to remove)" : "(to add)"}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={adjustQty || ""}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                  placeholder="Enter quantity"
                />
                {adjustQty > 0 && (
                  <p className="text-xs text-muted-foreground">
                    New stock will be:{" "}
                    <strong>
                      {["sale", "damage"].includes(adjustType)
                        ? Math.max(0, adjustProduct.stock_quantity - adjustQty)
                        : adjustProduct.stock_quantity + adjustQty}
                    </strong>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Reference (optional)</Label>
                <Input
                  value={adjustRef}
                  onChange={(e) => setAdjustRef(e.target.value)}
                  placeholder="PO number, invoice, etc."
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Add details about this adjustment..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustProduct(null)}>
              Cancel
            </Button>
            <Button onClick={submitAdjustment} disabled={!adjustQty || submitting}>
              {submitting ? "Saving..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Movement History Dialog */}
      <Dialog open={!!historyProduct} onOpenChange={(open) => !open && setHistoryProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Stock History: {historyProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Change</th>
                  <th className="px-3 py-2 text-left font-medium">Stock</th>
                  <th className="px-3 py-2 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {productMovements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(m.created_at).toLocaleDateString()}{" "}
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">{movementBadge(m.movement_type)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-medium ${
                          m.quantity_change > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.quantity_before} &rarr; {m.quantity_after}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs max-w-40 truncate">
                      {m.notes || m.reference || "\u2014"}
                    </td>
                  </tr>
                ))}
                {!productMovements.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No movement history for this product
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
