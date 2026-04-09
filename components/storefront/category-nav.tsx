import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function CategoryNav() {
  const supabase = createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("name, slug")
    .order("sort_order");

  if (!categories?.length) return null;

  return (
    <nav className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl overflow-x-auto px-4">
        <div className="flex gap-1 py-2">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
