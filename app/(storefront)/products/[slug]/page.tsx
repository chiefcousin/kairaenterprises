import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { WhatsAppButton } from "@/components/storefront/whatsapp-button";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/whatsapp";
import { getStoreSetting } from "@/lib/store-settings";
import { ViewTracker } from "@/components/storefront/view-tracker";
import { ProductJsonLd } from "@/components/storefront/product-jsonld";
import { ShareButton } from "@/components/storefront/share-button";
import { MobileWhatsAppBar } from "@/components/storefront/mobile-whatsapp-bar";
import { ProductReviews } from "@/components/storefront/product-reviews";
import type { Metadata } from "next";
import type { ProductWithImages, ProductWithPrimaryImage } from "@/lib/types";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, description, product_images(url)")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .single();

  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description || `Buy ${product.name} at Kaira Enterprises`,
    openGraph: {
      images: product.product_images?.[0]?.url
        ? [product.product_images[0].url]
        : [],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*, product_images(*), categories(name, slug)")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .single();

  if (!product) notFound();

  const typedProduct = product as unknown as ProductWithImages;
  const whatsappNumber = await getStoreSetting("whatsapp_number");

  // Fetch related products
  const { data: related } = await supabase
    .from("products")
    .select("*, product_images(url, alt_text), categories(name, slug)")
    .eq("is_active", true)
    .eq("category_id", typedProduct.category_id || "")
    .neq("id", typedProduct.id)
    .limit(4);

  const hasDiscount =
    typedProduct.compare_at_price &&
    typedProduct.compare_at_price > typedProduct.price;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ViewTracker productId={typedProduct.id} />
      <ProductJsonLd product={typedProduct} />

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        {typedProduct.categories && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/categories/${typedProduct.categories.slug}`}
              className="hover:text-foreground"
            >
              {typedProduct.categories.name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-foreground">{typedProduct.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Gallery */}
        <ProductGallery images={typedProduct.product_images} videoUrl={typedProduct.video_url} />

        {/* Info */}
        <div className="space-y-6">
          <div>
            {typedProduct.brand && (
              <p className="mb-1 text-sm text-muted-foreground">
                {typedProduct.brand}
              </p>
            )}
            <h1 className="text-3xl font-bold">{typedProduct.name}</h1>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">
              {formatPrice(typedProduct.price)}
            </span>
            {hasDiscount && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(typedProduct.compare_at_price!)}
              </span>
            )}
            {hasDiscount && (
              <Badge className="bg-red-500">
                {Math.round(
                  ((typedProduct.compare_at_price! - typedProduct.price) /
                    typedProduct.compare_at_price!) *
                    100
                )}
                % OFF
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {typedProduct.age_range && (
              <Badge variant="secondary">Ages {typedProduct.age_range}</Badge>
            )}
            {typedProduct.stock_quantity > 0 ? (
              <Badge
                variant="secondary"
                className="bg-green-50 text-green-700"
              >
                In Stock ({typedProduct.stock_quantity})
              </Badge>
            ) : (
              <Badge variant="destructive">Out of Stock</Badge>
            )}
            {typedProduct.sku && (
              <Badge variant="outline">SKU: {typedProduct.sku}</Badge>
            )}
          </div>

          {typedProduct.description && (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{typedProduct.description}</p>
            </div>
          )}

          {typedProduct.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {typedProduct.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="border-t pt-6 space-y-4">
            <WhatsAppButton
              product={{
                id: typedProduct.id,
                name: typedProduct.name,
                price: typedProduct.price,
                slug: typedProduct.slug,
              }}
              whatsappNumber={whatsappNumber}
              disabled={typedProduct.stock_quantity === 0}
            />
            <ShareButton name={typedProduct.name} />
          </div>
        </div>
      </div>

      {/* Reviews & Ratings */}
      <ProductReviews productId={typedProduct.id} />

      {/* Related Products */}
      {related && related.length > 0 && (
        <section className="mt-16 mb-20 md:mb-0">
          <h2 className="mb-6 text-2xl font-bold">You May Also Like</h2>
          <ProductGrid
            products={related as unknown as ProductWithPrimaryImage[]}
          />
        </section>
      )}

      {/* Mobile fixed WhatsApp bar */}
      <MobileWhatsAppBar
        product={{
          id: typedProduct.id,
          name: typedProduct.name,
          price: typedProduct.price,
          slug: typedProduct.slug,
        }}
        whatsappNumber={whatsappNumber}
        disabled={typedProduct.stock_quantity === 0}
      />
    </div>
  );
}
