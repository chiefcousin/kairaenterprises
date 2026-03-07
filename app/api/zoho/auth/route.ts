import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getZohoConfig } from "@/lib/zoho/client";

/**
 * GET /api/zoho/auth
 * Redirects the admin to the Zoho OAuth consent screen.
 * Protected — requires an authenticated admin session.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getZohoConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Zoho is not configured. Add your credentials in Admin → Settings first." },
      { status: 400 }
    );
  }

  const domain = config.domain || "in";
  const authUrl = `https://accounts.zoho.${domain}/oauth/v2/auth`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: [
      "ZohoInventory.items.READ",
      "ZohoInventory.items.UPDATE",
      "ZohoInventory.salesorders.CREATE",
      "ZohoInventory.salesorders.READ",
    ].join(","),
    redirect_uri: config.redirectUri,
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`${authUrl}?${params.toString()}`);
}
