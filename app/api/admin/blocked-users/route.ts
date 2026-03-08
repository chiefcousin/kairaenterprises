import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/roles";

async function getCallerInfo() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const role = await getUserRole(user.id);
  return { user, role };
}

// GET: List all blocked users
export async function GET() {
  const caller = await getCallerInfo();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("blocked_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocked: data });
}

// POST: Block a user by phone and/or email
export async function POST(request: NextRequest) {
  const caller = await getCallerInfo();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const phone = (body?.phone as string)?.trim().replace(/\s+/g, "") || null;
  const email = (body?.email as string)?.trim().toLowerCase() || null;
  const reason = (body?.reason as string)?.trim() || null;

  if (!phone && !email) {
    return NextResponse.json(
      { error: "At least a phone number or email is required" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Check if already blocked
  const conditions: string[] = [];
  if (phone) conditions.push(`phone.eq.${phone}`);
  if (email) conditions.push(`email.eq.${email}`);

  const { data: existing } = await adminClient
    .from("blocked_users")
    .select("id")
    .or(conditions.join(","))
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This user is already blocked" },
      { status: 409 }
    );
  }

  const { error } = await adminClient.from("blocked_users").insert({
    phone: phone || null,
    email: email || null,
    reason,
    blocked_by: caller.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If the blocked user has an active customer session, clear their verification
  // so the middleware cookie check will fail on next request
  if (phone) {
    await adminClient
      .from("customers")
      .update({ is_verified: false })
      .eq("phone", phone);
  }

  return NextResponse.json({ ok: true });
}

// DELETE: Unblock a user
export async function DELETE(request: NextRequest) {
  const caller = await getCallerInfo();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("blocked_users")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
