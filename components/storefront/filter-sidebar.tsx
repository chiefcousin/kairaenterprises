"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AGE_RANGES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, X } from "lucide-react";

interface FilterSidebarProps {
  categories: { name: string; slug: string }[];
  brands: string[];
  currentFilters: Record<string, string>;
}

function FilterContent({
  categories,
  brands,
  currentFilters,
  setFilter,
  clearFilters,
}: FilterSidebarProps & {
  setFilter: (key: string, value: string | null) => void;
  clearFilters: () => void;
}) {
  const hasFilters = Object.keys(currentFilters).some(
    (k) => k !== "sort" && k !== "page"
  );

  return (
    <div className="space-y-6">
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full justify-start text-destructive hover:text-destructive"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Clear all filters
        </Button>
      )}

      {/* Category */}
      <div>
        <Label className="mb-2 block text-sm font-semibold">Category</Label>
        <div className="space-y-0.5">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() =>
                setFilter(
                  "category",
                  currentFilters.category === cat.slug ? null : cat.slug
                )
              }
              className={`block w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                currentFilters.category === cat.slug
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <Label className="mb-2 block text-sm font-semibold">Price</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            defaultValue={currentFilters.min_price || ""}
            onBlur={(e) => setFilter("min_price", e.target.value || null)}
            className="w-full"
          />
          <Input
            type="number"
            placeholder="Max"
            defaultValue={currentFilters.max_price || ""}
            onBlur={(e) => setFilter("max_price", e.target.value || null)}
            className="w-full"
          />
        </div>
      </div>

      {/* Age Range */}
      <div>
        <Label className="mb-2 block text-sm font-semibold">Age</Label>
        <div className="space-y-0.5">
          {AGE_RANGES.map((range) => (
            <button
              key={range}
              onClick={() =>
                setFilter(
                  "age_range",
                  currentFilters.age_range === range ? null : range
                )
              }
              className={`block w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                currentFilters.age_range === range
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Brand */}
      {brands.length > 0 && (
        <div>
          <Label className="mb-2 block text-sm font-semibold">Brand</Label>
          <div className="space-y-0.5">
            {brands.map((b) => (
              <button
                key={b}
                onClick={() =>
                  setFilter(
                    "brand",
                    currentFilters.brand === b ? null : b
                  )
                }
                className={`block w-full rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  currentFilters.brand === b
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggles */}
      <div className="space-y-2">
        <Label className="mb-2 block text-sm font-semibold">Availability</Label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={currentFilters.in_stock === "true"}
            onChange={(e) =>
              setFilter("in_stock", e.target.checked ? "true" : null)
            }
            className="rounded border-input"
          />
          <span className="text-sm">In stock only</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={currentFilters.on_sale === "true"}
            onChange={(e) =>
              setFilter("on_sale", e.target.checked ? "true" : null)
            }
            className="rounded border-input"
          />
          <span className="text-sm">On sale</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={currentFilters.is_featured === "true"}
            onChange={(e) =>
              setFilter("is_featured", e.target.checked ? "true" : null)
            }
            className="rounded border-input"
          />
          <span className="text-sm">Featured</span>
        </label>
      </div>
    </div>
  );
}

export function FilterSidebar(props: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/products");
  }

  const activeCount = Object.keys(props.currentFilters).filter(
    (k) => k !== "sort" && k !== "page"
  ).length;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <FilterContent {...props} setFilter={setFilter} clearFilters={clearFilters} />
      </div>

      {/* Mobile filter button + drawer */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(true)}
          className="w-full"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        {/* Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative ml-auto flex h-full w-80 max-w-[85vw] flex-col bg-card shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold">Filters</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <FilterContent
                  {...props}
                  setFilter={(key, value) => {
                    setFilter(key, value);
                    setMobileOpen(false);
                  }}
                  clearFilters={() => {
                    clearFilters();
                    setMobileOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Displays active filters as removable chips above the product grid */
export function ActiveFilters({
  currentFilters,
}: {
  currentFilters: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filterLabels: Record<string, (v: string) => string> = {
    category: (v) => `Category: ${v}`,
    age_range: (v) => `Age: ${v}`,
    brand: (v) => `Brand: ${v}`,
    min_price: (v) => `Min: ${v}`,
    max_price: (v) => `Max: ${v}`,
    in_stock: () => "In stock",
    on_sale: () => "On sale",
    is_featured: () => "Featured",
  };

  const active = Object.entries(currentFilters).filter(
    ([k]) => k !== "sort" && k !== "page" && filterLabels[k]
  );

  if (active.length === 0) return null;

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([key, value]) => (
        <button
          key={key}
          onClick={() => removeFilter(key)}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {filterLabels[key](value)}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
