import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getUserRole,
  canViewCustomers,
  canAddCustomers,
  canDeleteCustomers,
} from "@/lib/roles";

async function getCallerInfo() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const role = await getUserRole(user.id);
  return { user, role };
}

// GET: List all customers
export async function GET() {
  const caller = await getCallerInfo();
  if (!caller || !canViewCustomers(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: data, callerRole: caller.role });
}

// POST: Add a new customer
export async function POST(request: NextRequest) {
  const caller = await getCallerInfo();
  if (!caller || !canAddCustomers(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = body?.name as string | undefined;
  const phone = body?.phone as string | undefined;
  const address = body?.address as string | undefined;
  const businessName = body?.business_name as string | undefined;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!phone || phone.trim().length < 7) {
    return NextResponse.json(
      { error: "Valid phone number is required" },
      { status: 400 }
    );
  }

  const cleanPhone = phone.trim().replace(/\s+/g, "");
  const adminClient = createAdminClient();

  const { error } = await adminClient.from("customers").upsert(
    {
      phone: cleanPhone,
      name: name.trim(),
      address: address?.trim() || null,
      business_name: businessName?.trim() || null,
      is_verified: true,
      approval_status: "approved",
    },
    { onConflict: "phone" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: Remove a customer by id (admin only)
export async function DELETE(request: NextRequest) {
  const caller = await getCallerInfo();
  if (!caller || !canDeleteCustomers(caller.role)) {
    return NextResponse.json(
      { error: "Only admins can delete customers" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("customers")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
