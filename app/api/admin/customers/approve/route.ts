import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/roles";

// PATCH: Approve or reject a customer
export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await getUserRole(user.id);
  // Admin and partner can approve
  if (role !== "admin" && role !== "partner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const customerId = body?.id as string;
  const action = body?.action as "approve" | "reject";

  if (!customerId || !action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve/reject) are required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: customer } = await adminClient
    .from("customers")
    .select("name, phone, business_name")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { error } = await adminClient
    .from("customers")
    .update({
      approval_status: action === "approve" ? "approved" : "rejected",
      is_verified: action === "approve",
    })
    .eq("id", customerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create notification about the action
  await adminClient.from("admin_notifications").insert({
    type: "general",
    title: action === "approve" ? "Customer Approved" : "Customer Rejected",
    message: `${customer.name} (${customer.business_name}) has been ${action === "approve" ? "approved" : "rejected"}.`,
    link: "/admin/customers",
  });

  return NextResponse.json({ ok: true });
}
