"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <select
      defaultValue={current}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border px-3 py-1.5 text-sm"
    >
      <option value="newest">Newest Arrivals</option>
      <option value="bestsellers">Bestsellers</option>
      <option value="price_asc">Price: Low to High</option>
      <option value="price_desc">Price: High to Low</option>
      <option value="discount">Biggest Discount</option>
      <option value="name">Name: A to Z</option>
    </select>
  );
}
