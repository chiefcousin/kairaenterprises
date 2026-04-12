import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBlocked } from "@/lib/blocked-users";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = (body?.username as string)?.trim();
  const password = body?.password as string;

  if (!username) {
    return NextResponse.json({ error: "Email or WhatsApp number is required" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Look up by email or phone
  const isEmail = username.includes("@");
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq(isEmail ? "email" : "phone", isEmail ? username.toLowerCase() : username.replace(/\s+/g, ""))
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: "No account found. Please sign up first." }, { status: 404 });
  }

  // Check blocked
  const blocked = await isBlocked({ phone: customer.phone, email: customer.email || undefined });
  if (blocked) {
    return NextResponse.json(
      { error: "This account has been blocked. Please contact support." },
      { status: 403 }
    );
  }

  // Check password
  if (!customer.password_hash) {
    return NextResponse.json(
      { error: "This account was created before the new system. Please sign up again with a password." },
      { status: 400 }
    );
  }

  const passwordHash = hashPassword(password);
  if (passwordHash !== customer.password_hash) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Check approval status
  if (customer.approval_status === "pending") {
    return NextResponse.json(
      { error: "Your account is pending approval. Please wait for admin approval." },
      { status: 403 }
    );
  }
  if (customer.approval_status === "rejected") {
    return NextResponse.json(
      { error: "Your account request was rejected. Please contact support." },
      { status: 403 }
    );
  }

  // Approved — set cookie
  const response = NextResponse.json({ ok: true, name: customer.name });
  response.cookies.set("ka_customer", customer.phone, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
