import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Eye, MessageCircle, Users, ShoppingBag } from "lucide-react";

interface ProductAnalyticsRow {
  product_id: string;
  product_name: string;
  views: number;
  clicks: number;
  fulfilled: number;
  revenue: number;
}

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = createClient();

  const [analyticsResult, returningResult, totalRevenueResult, totalOrdersResult] =
    await Promise.all([
      supabase.rpc("get_product_sales_analytics", { days_back: 30 }),
      supabase.rpc("get_returning_customers_count"),
      supabase
        .from("whatsapp_orders")
        .select("price, quantity")
        .eq("status", "fulfilled"),
      supabase
        .from("whatsapp_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "fulfilled"),
    ]);

  const analytics: ProductAnalyticsRow[] = (analyticsResult.data || []) as ProductAnalyticsRow[];
  const returningCount = (returningResult.data as number) || 0;
  const totalRevenue =
    (totalRevenueResult.data || []).reduce(
      (sum: number, row: { price: number; quantity: number }) =>
        sum + row.price * row.quantity,
      0
    );
  const totalFulfilled = totalOrdersResult.count || 0;

  const topBySales = [...analytics].sort((a, b) => b.fulfilled - a.fulfilled).slice(0, 10);
  const topByViews = [...analytics].sort((a, b) => b.views - a.views).slice(0, 10);
  const topByClicks = [...analytics].sort((a, b) => b.clicks - a.clicks).slice(0, 10);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <p className="text-muted-foreground text-sm">Product performance over the last 30 days</p>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">From fulfilled orders (all time)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders Fulfilled</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFulfilled}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Product Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.reduce((sum, r) => sum + Number(r.views), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Returning Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{returningCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Customers with 2+ orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Top Selling Products (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topBySales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">#</th>
                    <th className="pb-2 font-medium text-muted-foreground">Product</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Views</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">WA Clicks</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Fulfilled</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Revenue</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topBySales.map((row, i) => {
                    const convRate =
                      row.clicks > 0
                        ? Math.round((row.fulfilled / row.clicks) * 100)
                        : 0;
                    return (
                      <tr key={row.product_id} className="hover:bg-muted/30">
                        <td className="py-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-3 font-medium">{row.product_name}</td>
                        <td className="py-3 text-right text-muted-foreground">{Number(row.views).toLocaleString()}</td>
                        <td className="py-3 text-right text-muted-foreground">{Number(row.clicks).toLocaleString()}</td>
                        <td className="py-3 text-right">
                          <span className="font-semibold text-green-700">{Number(row.fulfilled).toLocaleString()}</span>
                        </td>
                        <td className="py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                        <td className="py-3 text-right">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              convRate >= 50
                                ? "bg-green-100 text-green-700"
                                : convRate >= 20
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {convRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sales data yet</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Viewed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Most Viewed Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topByViews.filter((r) => r.views > 0).length > 0 ? (
              <div className="space-y-3">
                {topByViews
                  .filter((r) => r.views > 0)
                  .map((row, i) => (
                    <div key={row.product_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-muted-foreground text-xs">{i + 1}</span>
                        <span className="font-medium">{row.product_name}</span>
                      </div>
                      <span className="text-muted-foreground">{Number(row.views).toLocaleString()} views</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No view data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Most WhatsApp Clicked */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Most WhatsApp Orders Initiated
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topByClicks.filter((r) => r.clicks > 0).length > 0 ? (
              <div className="space-y-3">
                {topByClicks
                  .filter((r) => r.clicks > 0)
                  .map((row, i) => (
                    <div key={row.product_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-muted-foreground text-xs">{i + 1}</span>
                        <span className="font-medium">{row.product_name}</span>
                      </div>
                      <span className="text-muted-foreground">{Number(row.clicks).toLocaleString()} clicks</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No click data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
