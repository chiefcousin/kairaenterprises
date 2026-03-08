import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBlocked } from "@/lib/blocked-users";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const phone = body?.phone as string | undefined;
  const otp = body?.otp as string | undefined;

  if (!phone || !otp) {
    return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
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

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, otp_code, otp_expires_at, is_verified")
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (error || !customer) {
    return NextResponse.json({ error: "Phone number not found. Please request a new OTP." }, { status: 400 });
  }

  if (customer.is_verified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  if (!customer.otp_code || !customer.otp_expires_at) {
    return NextResponse.json({ error: "No OTP found. Please request a new one." }, { status: 400 });
  }

  if (new Date(customer.otp_expires_at) < new Date()) {
    return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
  }

  if (customer.otp_code !== otp.trim()) {
    return NextResponse.json({ error: "Incorrect OTP. Please try again." }, { status: 400 });
  }

  // Mark as verified and clear OTP
  const { error: updateError } = await supabase
    .from("customers")
    .update({ is_verified: true, otp_code: null, otp_expires_at: null })
    .eq("phone", cleanPhone);

  if (updateError) {
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, customer_id: customer.id });
}
