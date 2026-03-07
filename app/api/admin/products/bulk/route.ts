import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface BulkProductRow {
  name: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  stock_quantity?: number;
  brand?: string;
  category?: string;
  age_range?: string;
  tags?: string;
  is_active?: boolean;
  is_featured?: boolean;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role || "admin";
  if (role !== "admin" && role !== "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const products: BulkProductRow[] = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "No products provided" },
        { status: 400 }
      );
    }

    if (products.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 products per import" },
        { status: 400 }
      );
    }

    // Fetch existing categories for matching
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name");

    const categoryMap = new Map<string, string>();
    categories?.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase().trim(), cat.id);
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; name: string; error: string }[],
    };

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const rows = batch.map((p, idx) => {
        const rowNum = i + idx + 1;

        // Validate required fields
        if (!p.name || p.name.trim() === "") {
          results.failed++;
          results.errors.push({
            row: rowNum,
            name: p.name || "(empty)",
            error: "Product name is required",
          });
          return null;
        }

        if (p.price == null || isNaN(Number(p.price)) || Number(p.price) < 0) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            name: p.name,
            error: "Valid price is required",
          });
          return null;
        }

        // Generate slug
        const slug =
          p.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 5);

        // Match category by name
        let category_id: string | null = null;
        if (p.category) {
          category_id =
            categoryMap.get(p.category.toLowerCase().trim()) || null;
        }

        // Parse tags
        let tags: string[] = [];
        if (p.tags) {
          tags = String(p.tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        }

        // Parse boolean values
        const parseBoolean = (val: unknown): boolean => {
          if (typeof val === "boolean") return val;
          if (typeof val === "string") {
            const lower = val.toLowerCase().trim();
            return (
              lower === "true" ||
              lower === "yes" ||
              lower === "1" ||
              lower === "active"
            );
          }
          return false;
        };

        return {
          name: p.name.trim(),
          slug,
          description: p.description?.trim() || null,
          price: Number(p.price),
          compare_at_price: p.compare_at_price
            ? Number(p.compare_at_price)
            : null,
          sku: p.sku?.trim() || null,
          stock_quantity: p.stock_quantity ? Number(p.stock_quantity) : 0,
          brand: p.brand?.trim() || null,
          category_id,
          age_range: p.age_range?.trim() || null,
          tags,
          is_active:
            p.is_active !== undefined ? parseBoolean(p.is_active) : true,
          is_featured:
            p.is_featured !== undefined ? parseBoolean(p.is_featured) : false,
        };
      });

      const validRows = rows.filter(Boolean);
      if (validRows.length === 0) continue;

      const { data, error } = await supabase
        .from("products")
        .insert(validRows)
        .select("id, name");

      if (error) {
        // If batch insert fails, try one by one
        for (let j = 0; j < validRows.length; j++) {
          const row = validRows[j]!;
          const { error: singleError } = await supabase
            .from("products")
            .insert(row);

          if (singleError) {
            results.failed++;
            results.errors.push({
              row: i + j + 1,
              name: row.name,
              error: singleError.message.includes("duplicate")
                ? "Duplicate product (name or SKU already exists)"
                : singleError.message,
            });
          } else {
            results.success++;
          }
        }
      } else {
        results.success += data?.length || validRows.length;
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Bulk import error:", err);
    return NextResponse.json(
      { error: "Failed to process import" },
      { status: 500 }
    );
  }
}
