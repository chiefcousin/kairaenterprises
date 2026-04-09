import { ProductCard } from "./product-card";
import type { ProductWithPrimaryImage } from "@/lib/types";

export function ProductGrid({
  products,
  emptyMessage = "No products found",
}: {
  products: ProductWithPrimaryImage[];
  emptyMessage?: string;
}) {
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
