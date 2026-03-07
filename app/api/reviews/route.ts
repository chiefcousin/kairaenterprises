import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product_id");
  if (!productId) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: reviews, error } = await supabase
    .from("product_reviews")
    .select("id, customer_name, rating, title, review, created_at")
    .eq("product_id", productId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate summary
  const count = reviews?.length || 0;
  const average =
    count > 0
      ? reviews!.reduce((sum, r) => sum + r.rating, 0) / count
      : 0;

  return NextResponse.json({ reviews: reviews || [], average, count });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { product_id, customer_phone, customer_name, rating, title, review } = body;

  if (!product_id || !customer_phone || !rating) {
    return NextResponse.json(
      { error: "product_id, customer_phone, and rating are required" },
      { status: 400 }
    );
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  // Verify customer exists
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("phone", customer_phone)
    .single();

  if (!customer) {
    return NextResponse.json(
      { error: "Please sign up before leaving a review" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .upsert(
      {
        product_id,
        customer_phone,
        customer_name: customer_name || customer.name,
        rating,
        title: title || null,
        review: review || null,
      },
      { onConflict: "product_id,customer_phone" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}
