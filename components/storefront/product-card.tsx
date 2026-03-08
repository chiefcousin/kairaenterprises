import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/whatsapp";
import type { ProductWithPrimaryImage } from "@/lib/types";

export function ProductCard({ product }: { product: ProductWithPrimaryImage }) {
  const primaryImage = product.product_images?.[0];
  const hasDiscount =
    product.compare_at_price && product.compare_at_price > product.price;

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
        <div className="relative aspect-square bg-muted">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={primaryImage.alt_text || product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
          {hasDiscount && (
            <Badge className="absolute left-2 top-2 bg-red-500">Sale</Badge>
          )}
          {product.stock_quantity === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Badge variant="secondary" className="text-sm">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>
        <div className="p-3">
          {product.categories && (
            <p className="mb-1 text-xs text-muted-foreground">
              {product.categories.name}
            </p>
          )}
          <h3 className="line-clamp-2 text-sm font-medium leading-tight">
            {product.name}
          </h3>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-semibold text-primary">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
          </div>
          {product.age_range && (
            <p className="mt-1 text-xs text-muted-foreground">
              Ages {product.age_range}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
