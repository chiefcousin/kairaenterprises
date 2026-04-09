import { createClient } from "@/lib/supabase/server";
import { HeroBanner } from "@/components/storefront/hero-banner";
import { ProductGrid } from "@/components/storefront/product-grid";
import { QuickFilters } from "@/components/storefront/quick-filters";
import { getStoreSettings } from "@/lib/store-settings";
import Link from "next/link";
import Image from "next/image";
import type { ProductWithPrimaryImage, Category } from "@/lib/types";

export default async function HomePage() {
  const supabase = createClient();
  const settings = await getStoreSettings();

  // Fetch featured products
  const { data: featured } = await supabase
    .from("products")
    .select("*, product_images(url, alt_text), categories(name, slug)")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(8);

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");

  return (
    <>
      <HeroBanner
        title={settings.hero_title || "Welcome to Kaira Enterprises"}
        subtitle={
          settings.hero_subtitle ||
          "Your favorite local toy store - browse online, order via WhatsApp!"
        }
      />

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <h2 className="mb-6 text-2xl font-bold">Shop by Category</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categories.map((cat: Category) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:border-primary hover:bg-primary/5"
              >
                {cat.image_url ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full">
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl">
                    🧸
                  </div>
                )}
                <span className="text-center text-sm font-medium">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Browse Toys — quick filter chips */}
      {categories && categories.length > 0 && (
        <QuickFilters
          categories={(categories as Category[]).map((c) => ({
            name: c.name,
            slug: c.slug,
          }))}
        />
      )}

      {/* Featured Products */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Featured Toys</h2>
            <Link
              href="/products"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all &rarr;
            </Link>
          </div>
          <ProductGrid
            products={featured as unknown as ProductWithPrimaryImage[]}
          />
        </section>
      )}
    </>
  );
}
