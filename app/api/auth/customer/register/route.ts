import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBlocked } from "@/lib/blocked-users";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = (body?.name as string)?.trim();
  const phone = (body?.phone as string)?.trim().replace(/\s+/g, "");
  const email = (body?.email as string)?.trim().toLowerCase() || null;
  const businessName = (body?.business_name as string)?.trim();
  const address = (body?.address as string)?.trim();
  const password = body?.password as string;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!phone || phone.length < 7) {
    return NextResponse.json({ error: "Valid WhatsApp number is required" }, { status: 400 });
  }
  if (!businessName) {
    return NextResponse.json({ error: "Business/Company name is required" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Check if blocked
  const blocked = await isBlocked({ phone, email: email || undefined });
  if (blocked) {
    return NextResponse.json(
      { error: "This account has been blocked. Please contact support." },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  // Check if phone or email already exists
  const { data: existing } = await supabase
    .from("customers")
    .select("id, approval_status")
    .or(`phone.eq.${phone}${email ? `,email.eq.${email}` : ""}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.approval_status === "pending") {
      return NextResponse.json(
        { error: "Your account is pending approval. Please wait for admin approval." },
        { status: 409 }
      );
    }
    if (existing.approval_status === "approved") {
      return NextResponse.json(
        { error: "An account with this phone/email already exists. Please sign in instead." },
        { status: 409 }
      );
    }
    if (existing.approval_status === "rejected") {
      return NextResponse.json(
        { error: "Your previous request was rejected. Please contact support." },
        { status: 403 }
      );
    }
  }

  const passwordHash = hashPassword(password);

  const { error } = await supabase.from("customers").insert({
    phone,
    email,
    name,
    business_name: businessName,
    address,
    password_hash: passwordHash,
    is_verified: false,
    approval_status: "pending",
  });

  if (error) {
    console.error("[register] DB error:", error);
    if (error.code === "23505") {
      return NextResponse.json({ error: "An account with this phone or email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  // Create admin notification
  await supabase.from("admin_notifications").insert({
    type: "signup_request",
    title: "New Signup Request",
    message: `${name} from ${businessName} has requested account approval. Phone: ${phone}`,
    link: "/admin/customers",
  });

  // Send WhatsApp notification to admin
  try {
    const { data: whatsappSetting } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "whatsapp_number")
      .maybeSingle();

    if (whatsappSetting?.value) {
      const adminPhone = whatsappSetting.value.replace(/\D/g, "");
      const message = encodeURIComponent(
        `New Signup Request!\n\nName: ${name}\nBusiness: ${businessName}\nPhone: ${phone}\n${email ? `Email: ${email}\n` : ""}Address: ${address}\n\nPlease approve from the admin panel: /admin/customers`
      );
      // Fire-and-forget WhatsApp API link (will be opened by admin via notification)
      // Store the WhatsApp link in the notification for now
      await supabase
        .from("admin_notifications")
        .update({
          message: `${name} from ${businessName} has requested account approval. Phone: ${phone}. [Send WhatsApp](https://wa.me/${adminPhone}?text=${message})`,
        })
        .eq("title", "New Signup Request")
        .eq("link", "/admin/customers")
        .order("created_at", { ascending: false })
        .limit(1);
    }
  } catch {
    // Non-critical — notification was already created
  }

  return NextResponse.json({
    ok: true,
    message: "Your account request has been submitted. You will be notified once approved.",
  });
}
