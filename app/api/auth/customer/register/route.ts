import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBlocked } from "@/lib/blocked-users";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = body?.name as string | undefined;
  const phone = body?.phone as string | undefined;
  const address = body?.address as string | undefined;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!phone || phone.trim().length < 7) {
    return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, "");

  // Check if this phone number is blocked
  const blocked = await isBlocked({ phone: cleanPhone });
  if (blocked) {
    return NextResponse.json(
      { error: "This account has been blocked. Please contact support." },
      { status: 403 }
    );
  }
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("customers")
    .upsert(
      {
        phone: cleanPhone,
        name: name.trim(),
        address: address?.trim() || null,
        is_verified: true,
        otp_code: null,
        otp_expires_at: null,
      },
      { onConflict: "phone" }
    );

  if (error) {
    console.error("[register] DB error:", error);
    return NextResponse.json({ error: "Failed to save details" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("ka_customer", cleanPhone, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return response;
}
