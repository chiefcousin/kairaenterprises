import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/roles";

async function requireAuth() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await getUserRole(user.id);
  return { user, role };
}

// GET: List notifications (latest first)
export async function GET(request: NextRequest) {
  const caller = await requireAuth();
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const adminClient = createAdminClient();
  let query = adminClient
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get unread count
  const { count } = await adminClient
    .from("admin_notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  return NextResponse.json({ notifications: data, unreadCount: count ?? 0 });
}

// PATCH: Mark notifications as read
export async function PATCH(request: NextRequest) {
  const caller = await requireAuth();
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids = body?.ids as string[] | undefined;
  const markAll = body?.markAll as boolean | undefined;

  const adminClient = createAdminClient();

  if (markAll) {
    await adminClient
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("is_read", false);
  } else if (ids && ids.length > 0) {
    await adminClient
      .from("admin_notifications")
      .update({ is_read: true })
      .in("id", ids);
  }

  return NextResponse.json({ ok: true });
}
