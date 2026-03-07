"use client";

import Link from "next/link";
import { AGE_RANGES } from "@/lib/constants";
import { formatPrice } from "@/lib/whatsapp";
import {
  Tag,
  Flame,
  BadgePercent,
  Baby,
  Clock,
  DollarSign,
} from "lucide-react";

interface QuickFiltersProps {
  categories: { name: string; slug: string }[];
}

const PRICE_RANGES = [
  { max: 500, params: "max_price=500" },
  { min: 500, max: 1000, params: "min_price=500&max_price=1000" },
  { min: 1000, max: 2000, params: "min_price=1000&max_price=2000" },
  { min: 2000, params: "min_price=2000" },
];

function priceLabel(range: { min?: number; max?: number }) {
  if (!range.min) return `Under ${formatPrice(range.max!)}`;
  if (!range.max) return `Over ${formatPrice(range.min)}`;
  return `${formatPrice(range.min)} – ${formatPrice(range.max)}`;
}

export function QuickFilters({ categories }: QuickFiltersProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <h2 className="mb-5 text-2xl font-bold">Browse Toys</h2>

      <div className="space-y-5">
        {/* Quick picks row */}
        <div className="flex flex-wrap gap-2">
          <FilterChip
            href="/products?sort=bestsellers"
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Bestsellers"
          />
          <FilterChip
            href="/products?on_sale=true"
            icon={<BadgePercent className="h-3.5 w-3.5" />}
            label="On Sale"
          />
          <FilterChip
            href="/products?is_featured=true"
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Featured"
          />
          <FilterChip
            href="/products?sort=newest"
            icon={<Clock className="h-3.5 w-3.5" />}
            label="New Arrivals"
          />
        </div>

        {/* Age range */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Baby className="h-4 w-4" />
            By Age
          </p>
          <div className="flex flex-wrap gap-2">
            {AGE_RANGES.map((range) => (
              <FilterChip
                key={range}
                href={`/products?age_range=${encodeURIComponent(range)}`}
                label={range}
              />
            ))}
          </div>
        </div>

        {/* Price range */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            By Price
          </p>
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((pr) => (
              <FilterChip
                key={pr.params}
                href={`/products?${pr.params}`}
                label={priceLabel(pr)}
              />
            ))}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              By Category
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <FilterChip
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  label={cat.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
    >
      {icon}
      {label}
    </Link>
  );
}
