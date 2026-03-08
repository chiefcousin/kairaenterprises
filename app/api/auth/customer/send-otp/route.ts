import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBlocked } from "@/lib/blocked-users";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = body?.phone as string | undefined;

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
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const supabase = createAdminClient();

  // Upsert customer record with OTP (create if new, update OTP if exists)
  const { error } = await supabase
    .from("customers")
    .upsert(
      {
        phone: cleanPhone,
        otp_code: otp,        // In production: store a hashed version
        otp_expires_at: expiresAt,
        is_verified: false,
        name: "",
      },
      { onConflict: "phone" }
    );

  if (error) {
    console.error("[send-otp] DB error:", error);
    return NextResponse.json({ error: "Failed to generate OTP" }, { status: 500 });
  }

  // TODO: Replace with WhatsApp Business API call when provider is configured.
  // Example providers: Meta Cloud API, Twilio Verify, Vonage
  // For now, return OTP in response for development/testing only.
  // In production, remove the otp field from the response and send via WhatsApp.
  console.log(`[DEV] OTP for ${cleanPhone}: ${otp}`);

  const isDev = process.env.NODE_ENV === "development";

  return NextResponse.json({
    ok: true,
    message: "OTP sent to your WhatsApp number",
    // Only expose OTP in development — remove this in production after WA API is set up
    ...(isDev ? { otp } : {}),
  });
}
