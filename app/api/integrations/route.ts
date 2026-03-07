import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/integrations
 * Saves integration credentials to store_settings.
 * Body: { platform: "zoho", config: { client_id, client_secret, ... } }
 * Protected — requires an authenticated admin session.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { platform: string; config: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { platform, config } = body;
  if (!platform || !config || typeof config !== "object") {
    return NextResponse.json(
      { error: "platform and config are required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();
  const now = new Date().toISOString();

  // Save each config field as {platform}_{key} in store_settings
  for (const [key, value] of Object.entries(config)) {
    await adminSupabase.from("store_settings").upsert(
      { key: `${platform}_${key}`, value: value ?? "", updated_at: now },
      { onConflict: "key" }
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/integrations?platform=zoho
 * Removes all credentials and tokens for a platform.
 * Protected — requires an authenticated admin session.
 */
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = request.nextUrl.searchParams.get("platform");
  if (!platform) {
    return NextResponse.json(
      { error: "platform query param is required" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  // Delete all store_settings rows that start with {platform}_
  await adminSupabase
    .from("store_settings")
    .delete()
    .like("key", `${platform}_%`);

  return NextResponse.json({ ok: true });
}
